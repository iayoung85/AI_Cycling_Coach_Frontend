// Plan file frontmatter
export interface AuthUser {
  id: number;
  name: string;
}

export interface AuthSession {
  access_token: string;
  user: AuthUser;
}

export interface PlanMeta {
  week_start: string;
  season: string;
  training_block: string;
  week_number: number;
}

// A single entry under a day (workout, life event, checkin, etc.)
export interface PlanEntry {
  time: string;            // "HH:MM" or "REST DAY"
  category: Category;
  title: string;
  description: string;     // markdown content below the heading
  workoutYaml?: WorkoutDetails;
  athleteNotes: string[];  // content from > [!NOTE] blocks
  date: string;            // YYYY-MM-DD (from parent day heading)
  eventId?: string;        // present only on user-created events
  allDay?: boolean;
}

export type UserEventCategory = Category;

// Payload for creating or updating a user event
export interface UserEventPayload {
  time?: string;
  category: UserEventCategory;
  title: string;
  notes?: string;
  workout_details?: Partial<WorkoutDetails>;
  all_day?: boolean;
  start_date?: string;
  end_date?: string;
}

// Response from create/update event endpoints
export interface UserEventResponse {
  event_id: string;
  time: string | null;
  category: string;
  title: string;
  notes: string | null;
  date: string;
  all_day: boolean;
  start_date: string;
  end_date: string;
  dates: string[];
  workout_details: Partial<WorkoutDetails> | null;
}

export type Category = 'Workout' | 'Life' | 'Work' | 'Note' | 'Checkin';

// Structured workout fields from yaml code block
export interface WorkoutDetails {
  type?: string;
  duration_minutes?: number;
  intensity?: string;
  tss_planned?: number;
  structure?: string[];
  notes?: string;
}

// A full parsed week
export interface PlanWeek {
  meta: PlanMeta;
  filename: string;
  summary: string;
  entries: PlanEntry[];
}

// Recurring event rule (stored in plans/recurring.json)
export interface RecurrenceException {
  original_date: string;
  deleted: boolean;
  time?: string;
  title?: string;
  notes?: string;
  workout_details?: Partial<WorkoutDetails>;
}

export interface RecurrenceRule {
  id: string;
  freq: 'daily' | 'weekly' | 'monthly';
  interval: number;
  byday: string[];          // e.g. ["MO", "WE", "FR"]
  bymonthday: number | null;
  start_date: string;       // YYYY-MM-DD
  until: string | null;     // YYYY-MM-DD
  time: string;             // HH:MM
  category: UserEventCategory;
  title: string;
  notes: string | null;
  workout_details: Partial<WorkoutDetails> | null;
  exceptions: RecurrenceException[];
  created_at: string;
}

// Payload for creating a recurring rule
export interface RecurrenceRulePayload {
  freq: 'daily' | 'weekly' | 'monthly';
  interval?: number;
  byday?: string[];
  bymonthday?: number;
  start_date: string;
  until?: string;
  time: string;
  category: UserEventCategory;
  title: string;
  notes?: string;
  workout_details?: Partial<WorkoutDetails>;
}

// Payload for updating a recurring rule
export interface RecurrenceUpdatePayload {
  edit_mode: 'all' | 'this_and_future' | 'this_only';
  target_date?: string;
  freq?: 'daily' | 'weekly' | 'monthly';
  interval?: number;
  byday?: string[];
  bymonthday?: number;
  until?: string;
  time?: string;
  title?: string;
  notes?: string;
}
