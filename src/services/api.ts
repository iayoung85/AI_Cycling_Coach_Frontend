import type { UserEventPayload, UserEventResponse, RecurrenceRule, RecurrenceRulePayload, RecurrenceUpdatePayload } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

let authToken: string | null = localStorage.getItem('auth_token');

function getMondayOf(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(year, month - 1, day);
  const weekday = value.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  value.setDate(value.getDate() + diff);
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function buildDateRange(startDate: string, endDate: string): string[] {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const dates: string[] = [];
  const cursor = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);

  while (cursor <= end) {
    dates.push([
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, '0'),
      String(cursor.getDate()).padStart(2, '0'),
    ].join('-'));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

async function ensureWeeksExistForEvent(date: string, payload: Partial<UserEventPayload>): Promise<void> {
  const startDate = payload.start_date ?? date;
  const endDate = payload.end_date ?? startDate;
  const targetDates = payload.all_day ? buildDateRange(startDate, endDate) : [startDate];
  const mondayDates = [...new Set(targetDates.map(getMondayOf))];
  const existingPlans = await fetchAllPlans();
  const existingWeeks = new Set(
    existingPlans
      .map(plan => plan.filename.match(/^week-(\d{4}-\d{2}-\d{2})\.md$/)?.[1])
      .filter((weekDate): weekDate is string => Boolean(weekDate))
  );

  await Promise.all(
    mondayDates
      .filter(mondayDate => !existingWeeks.has(mondayDate))
      .map(mondayDate => generateWeek(mondayDate))
  );
}

/** Update the stored auth token */
export function setAuthToken(token: string) {
  authToken = token;
  localStorage.setItem('auth_token', token);
}

/** Clear the stored auth token */
export function clearAuthToken() {
  authToken = null;
  localStorage.removeItem('auth_token');
}

/** Fetch wrapper that includes auth token and handles token refresh */
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response = await fetch(url, { ...options, headers });

  // If 401, try to refresh token
  if (response.status === 401) {
    try {
      const refreshResponse = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Send refresh token in httpOnly cookie
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setAuthToken(data.access_token);

        // Retry original request with new token
        headers.Authorization = `Bearer ${data.access_token}`;
        response = await fetch(url, { ...options, headers });
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
      clearAuthToken();
    }
  }

  return response;
}

/** Fetch all plan files from backend */
export async function fetchAllPlans(): Promise<Array<{ filename: string; content: string }>> {
  const response = await apiFetch('/api/plans');
  if (!response.ok) throw new Error(`Failed to fetch plans: ${response.status}`);
  const data = await response.json();
  return data.plans || [];
}

/** Submit athlete notes for a specific date */
export async function submitAthleteNote(
  date: string,
  note?: string,
  metadata?: { actual_duration?: number; freshness?: number; difficulty?: number; rpe?: number; stats?: string }
): Promise<{ success: boolean; message: string; note_content?: string }> {
  const body: Record<string, unknown> = {
    user_id: 1, // TODO: get from auth context
  };
  
  // Only include athlete_notes if provided
  if (note !== undefined && note !== null) {
    body.athlete_notes = note;
  }
  
  if (metadata) {
    Object.assign(body, metadata);
  }

  const res = await apiFetch(`/api/plans/${date}/notes`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to submit note: ${res.status}`);
  }

  const data = await res.json();
  return { success: true, message: data.message || 'Note submitted', note_content: data.note_content };
}

/** Generate a skeleton week file for the week containing the given date */
async function generateWeek(date: string): Promise<void> {
  const res = await apiFetch('/api/plans/generate-week', {
    method: 'POST',
    body: JSON.stringify({ user_id: 1, date }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to generate week: ${res.status}`);
  }
}

/** Create a new user event (Life, Work, or Workout) for a specific date */
export async function createEvent(date: string, payload: UserEventPayload): Promise<UserEventResponse> {
  if (payload.all_day || payload.start_date || payload.end_date) {
    await ensureWeeksExistForEvent(date, payload);
  }

  const res = await apiFetch(`/api/plans/${date}/events`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  // If the week file doesn't exist yet, auto-generate it and retry once
  if (res.status === 404) {
    await generateWeek(date);
    const retry = await apiFetch(`/api/plans/${date}/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!retry.ok) {
      const error = await retry.json().catch(() => ({}));
      throw new Error(error.error || `Failed to create event: ${retry.status}`);
    }
    return retry.json();
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to create event: ${res.status}`);
  }
  return res.json();
}

/** Update an existing user event */
export async function updateEvent(
  date: string,
  eventId: string,
  payload: Partial<UserEventPayload>
): Promise<UserEventResponse> {
  if (payload.all_day || payload.start_date || payload.end_date) {
    await ensureWeeksExistForEvent(date, payload);
  }

  const res = await apiFetch(`/api/plans/${date}/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to update event: ${res.status}`);
  }
  return res.json();
}

/** Delete a user event */
export async function deleteEvent(date: string, eventId: string): Promise<void> {
  const res = await apiFetch(`/api/plans/${date}/events/${eventId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to delete event: ${res.status}`);
  }
}

/** Reschedule a coach-written entry to a new day/time within the same week */
export async function rescheduleCoachEntry(
  date: string,
  time: string,
  category: string,
  title: string,
  newDate: string,
  newTime: string,
): Promise<{ date: string; time: string; category: string; title: string }> {
  const res = await apiFetch(`/api/plans/${date}/reschedule-entry`, {
    method: 'PUT',
    body: JSON.stringify({ time, category, title, new_date: newDate, new_time: newTime }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to reschedule entry: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Recurring rules
// ---------------------------------------------------------------------------

/** Fetch all recurring rules */
export async function fetchRecurringRules(): Promise<RecurrenceRule[]> {
  const res = await apiFetch('/api/recurring');
  if (!res.ok) throw new Error(`Failed to fetch recurring rules: ${res.status}`);
  const data = await res.json();
  return data.rules || [];
}

/** Create a new recurring rule (materializes ~6 months of events) */
export async function createRecurringRule(
  payload: RecurrenceRulePayload,
): Promise<{ rule: RecurrenceRule; materialized: number }> {
  const res = await apiFetch('/api/recurring', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to create recurring rule: ${res.status}`);
  }
  return res.json();
}

/** Update a recurring rule */
export async function updateRecurringRule(
  ruleId: string,
  payload: RecurrenceUpdatePayload,
): Promise<{ rule: RecurrenceRule }> {
  const res = await apiFetch(`/api/recurring/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to update recurring rule: ${res.status}`);
  }
  return res.json();
}

/** Delete a recurring rule and remove all its materialized instances */
export async function deleteRecurringRule(
  ruleId: string,
): Promise<{ success: boolean; instances_removed: number }> {
  const res = await apiFetch(`/api/recurring/${ruleId}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to delete recurring rule: ${res.status}`);
  }
  return res.json();
}

/** Trigger idempotent re-materialization of all rules across the next ~6 months */
export async function expandRecurringRules(): Promise<{ rules_processed: number; instances_materialized: number }> {
  const res = await apiFetch('/api/recurring/expand', { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to expand recurring rules: ${res.status}`);
  return res.json();
}
