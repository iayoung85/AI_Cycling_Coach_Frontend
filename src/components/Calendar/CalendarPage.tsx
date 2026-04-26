import { useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateClickArg } from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg } from '@fullcalendar/core';
import {
  fetchAllPlans,
  submitAthleteNote,
  createEvent,
  updateEvent,
  deleteEvent,
  rescheduleCoachEntry,
} from '../../services/api';
import { parsePlanFile, normalizeWorkoutDetails } from '../../services/planParser';
import type { PlanWeek, PlanEntry, Category, UserEventPayload, UserEventResponse } from '../../types';
import EntryDetailModal from '../EntryDetail/EntryDetailModal';
import {
  applyAthleteNoteToWeeks,
  buildAthleteNoteRequest,
  type EntryDetailModalNotePayload,
} from '../EntryDetail/entryNoteUtils';
import EventModal from './EventModal';
import './CalendarPage.css';

const CATEGORY_COLORS: Record<string, string> = {
  Workout: '#22c55e',
  Life: '#a78bfa',
  Work: '#f59e0b',
  Note: '#3b82f6',
  Checkin: '#06b6d4',
};

function getMondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateFromStart(start: Date): string {
  return [
    start.getFullYear(),
    String(start.getMonth() + 1).padStart(2, '0'),
    String(start.getDate()).padStart(2, '0'),
  ].join('-');
}

function timeFromStart(start: Date): string {
  return [
    String(start.getHours()).padStart(2, '0'),
    String(start.getMinutes()).padStart(2, '0'),
  ].join(':');
}

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const value = new Date(year, month - 1, day);
  value.setDate(value.getDate() + days);
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function buildEntriesFromResponse(result: UserEventResponse): PlanEntry[] {
  return result.dates.map(date => ({
    eventId: result.event_id,
    time: result.all_day ? 'All Day' : (result.time ?? '00:00'),
    category: result.category as Category,
    title: result.title,
    description: result.notes ?? '',
    workoutYaml: normalizeWorkoutDetails(result.workout_details),
    athleteNotes: [],
    date,
    allDay: result.all_day,
  }));
}

function weeksContainEntries(weeks: PlanWeek[], entries: PlanEntry[]): boolean {
  return entries.every(entry => weeks.some(week => week.meta.week_start === getMondayOf(entry.date)));
}

function upsertUserEventInWeeks(weeks: PlanWeek[], eventId: string, entries: PlanEntry[]): PlanWeek[] {
  const entriesByWeek = new Map<string, PlanEntry[]>();

  for (const entry of entries) {
    const monday = getMondayOf(entry.date);
    entriesByWeek.set(monday, [...(entriesByWeek.get(monday) ?? []), entry]);
  }

  return weeks.map(week => ({
    ...week,
    entries: [
      ...week.entries.filter(entry => entry.eventId !== eventId),
      ...(entriesByWeek.get(week.meta.week_start) ?? []),
    ],
  }));
}

function removeUserEventFromWeeks(weeks: PlanWeek[], eventId: string): PlanWeek[] {
  return weeks.map(week => ({
    ...week,
    entries: week.entries.filter(entry => entry.eventId !== eventId),
  }));
}

type EventModalState =
  | null
  | { mode: 'create'; date: string; time: string; allDay: boolean }
  | { mode: 'edit'; entry: PlanEntry; endDate?: string };

export default function CalendarPage() {
  const [weeks, setWeeks] = useState<PlanWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  ));

  // Coach-entry note modal
  const [noteEntry, setNoteEntry] = useState<PlanEntry | null>(null);

  // User-event CRUD modal
  const [eventModal, setEventModal] = useState<EventModalState>(null);

  const loadPlans = useCallback(async (options?: { forceRefresh?: boolean; preserveContent?: boolean }) => {
    try {
      if (options?.preserveContent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const planFiles = await fetchAllPlans({ forceRefresh: options?.forceRefresh });
      const parsed = planFiles.map(f => parsePlanFile(f.content, f.filename));
      setWeeks(parsed);
      setError(null);
    } catch (err) {
      console.error('Failed to load plans:', err);
      setError('Failed to load plan files. Check your backend connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const timedEvents = weeks.flatMap(week =>
    week.entries
      .filter(entry => entry.time !== 'REST' && !entry.allDay)
      .map(entry => ({
        id: entry.eventId ?? `${entry.date}-${entry.time}-${entry.title.slice(0, 20)}`,
        title: entry.title,
        start: `${entry.date}T${entry.time}:00`,
        allDay: false,
        backgroundColor: CATEGORY_COLORS[entry.category] ?? '#3b82f6',
        borderColor: entry.eventId
          ? (CATEGORY_COLORS[entry.category] ?? '#3b82f6')
          : 'transparent',
        editable: true,
        extendedProps: { entry },
      }))
  );

  const groupedAllDayEntries = new Map<string, PlanEntry[]>();
  for (const week of weeks) {
    for (const entry of week.entries) {
      if (!entry.allDay || !entry.eventId) {
        continue;
      }
      groupedAllDayEntries.set(entry.eventId, [...(groupedAllDayEntries.get(entry.eventId) ?? []), entry]);
    }
  }

  const allDayEvents = Array.from(groupedAllDayEntries.entries()).map(([eventId, entries]) => {
    const sortedEntries = [...entries].sort((left, right) => left.date.localeCompare(right.date));
    const firstEntry = sortedEntries[0];
    const lastEntry = sortedEntries[sortedEntries.length - 1];
    const color = CATEGORY_COLORS[firstEntry.category] ?? '#3b82f6';

    return {
      id: eventId,
      title: firstEntry.title,
      start: firstEntry.date,
      end: addDays(lastEntry.date, 1),
      allDay: true,
      backgroundColor: color,
      borderColor: color,
      editable: false,
      extendedProps: { entry: firstEntry, endDate: lastEntry.date },
    };
  });

  const fcEvents = [...timedEvents, ...allDayEvents];

  const handleEventClick = (clickInfo: EventClickArg) => {
    const entry = clickInfo.event.extendedProps.entry as PlanEntry;
    const endDate = clickInfo.event.extendedProps.endDate as string | undefined;
    if (entry.eventId) {
      setEventModal({ mode: 'edit', entry, endDate });
    } else {
      setNoteEntry(entry);
    }
  };

  const handleDateClick = (info: DateClickArg) => {
    const date = dateFromStart(info.date);
    const time = info.allDay ? '09:00' : timeFromStart(info.date);
    setEventModal({ mode: 'create', date, time, allDay: info.allDay });
  };

  const handleEventDrop = async (dropInfo: EventDropArg) => {
    const entry = dropInfo.event.extendedProps.entry as PlanEntry;
    const newStart = dropInfo.event.start!;
    const newDate = dateFromStart(newStart);
    const newTime = timeFromStart(newStart);

    if (dropInfo.event.allDay || entry.allDay) {
      dropInfo.revert();
      return;
    }

    try {
      if (entry.eventId) {
        const result = await updateEvent(entry.date, entry.eventId, {
          all_day: false,
          start_date: newDate,
          end_date: newDate,
          time: newTime,
          workout_details: entry.category === 'Workout' ? entry.workoutYaml : undefined,
        });
        const updatedEntries = buildEntriesFromResponse(result);
        if (!weeksContainEntries(weeks, updatedEntries)) {
          await loadPlans();
        } else {
          setWeeks(prev => upsertUserEventInWeeks(prev, entry.eventId!, updatedEntries));
        }
      } else {
        // ── Coach-written entry ─────────────────────────────────────────────
        if (getMondayOf(newDate) !== getMondayOf(entry.date)) {
          dropInfo.revert();
          return;
        }

        const result = await rescheduleCoachEntry(
          entry.date, entry.time, entry.category, entry.title, newDate, newTime
        );
        const resultEntry: PlanEntry = { ...entry, date: result.date, time: result.time };
        // Use title+date as the stable key for coach entries (no eventId)
        setWeeks(prev => prev.map(week => ({
          ...week,
          entries: week.entries.map(e =>
            e.date === entry.date && e.time === entry.time &&
            e.category === entry.category && e.title === entry.title
              ? resultEntry
              : e
          ),
        })));
      }
    } catch (err) {
      console.error('Event drop failed:', err);
      dropInfo.revert();
    }
  };

  const handleCreateEvent = async (payload: UserEventPayload) => {
    if (eventModal?.mode !== 'create') return;
    const eventDate = payload.start_date ?? eventModal.date;
    const result = await createEvent(eventDate, payload);
    const newEntries = buildEntriesFromResponse(result);

    if (!weeksContainEntries(weeks, newEntries)) {
      await loadPlans();
    } else {
      setWeeks(prev => upsertUserEventInWeeks(prev, result.event_id, newEntries));
    }
    setEventModal(null);
  };

  const handleUpdateEvent = async (payload: UserEventPayload) => {
    if (eventModal?.mode !== 'edit') return;
    const { entry } = eventModal;
    const result = await updateEvent(entry.date, entry.eventId!, payload);
    const updatedEntries = buildEntriesFromResponse(result);

    if (!weeksContainEntries(weeks, updatedEntries)) {
      await loadPlans();
    } else {
      setWeeks(prev => upsertUserEventInWeeks(prev, entry.eventId!, updatedEntries));
    }
    setEventModal(null);
  };

  const handleDeleteEvent = async () => {
    if (eventModal?.mode !== 'edit') return;
    const { entry } = eventModal;
    await deleteEvent(entry.date, entry.eventId!);
    setWeeks(prev => removeUserEventFromWeeks(prev, entry.eventId!));
    setEventModal(null);
  };

  const handleSubmitNote = async (payload: EntryDetailModalNotePayload) => {
    if (!noteEntry) return;
    const { noteToSend, metadata } = buildAthleteNoteRequest(noteEntry, payload);

    if (!noteToSend && !metadata) {
      return;
    }

    try {
      const result = await submitAthleteNote(noteEntry.date, noteToSend, metadata);

      if (result.note_content !== undefined) {
        const { weeks: updatedWeeks, updatedEntry } = applyAthleteNoteToWeeks(weeks, noteEntry, result.note_content);
        setWeeks(updatedWeeks);
        if (updatedEntry) {
          setNoteEntry(updatedEntry);
        }
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to submit note');
    }
  };

  const calendarView = isMobile ? 'dayGridMonth' : 'timeGridWeek';
  const calendarToolbar = isMobile
    ? { left: 'prev,next', center: 'title', right: 'dayGridMonth,timeGridDay' }
    : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' };

  if (loading) return <div className="calendar-page"><p>Loading plans…</p></div>;

  if (error) {
    return (
      <div className="calendar-page">
        <p className="error-text">{error}</p>
        <p className="page-subtitle">
          Make sure the backend is running at <code>http://127.0.0.1:5000</code> or set <code>VITE_API_URL</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      <div className="page-header">
        <div>
          <h2>Training Calendar</h2>
          <p className="page-subtitle">
            {weeks.length} week{weeks.length !== 1 ? 's' : ''} loaded &mdash; click a time slot, month day, or weekly all-day row to add an event
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost page-refresh-btn"
          onClick={() => void loadPlans({ forceRefresh: true, preserveContent: true })}
          disabled={loading || refreshing}
        >
          {refreshing ? 'Refreshing…' : 'Refresh from GitHub'}
        </button>
      </div>

      <div className="calendar-legend">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <span key={cat} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />
            {cat}
          </span>
        ))}
      </div>

      <div className="calendar-wrapper">
        <FullCalendar
          key={calendarView}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={calendarView}
          firstDay={1}
          headerToolbar={calendarToolbar}
          editable={true}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          dateClick={handleDateClick}
          events={fcEvents}
          height="auto"
          eventDisplay="block"
          dayMaxEventRows={isMobile ? 2 : true}
          slotMinTime="05:00:00"
          slotMaxTime="23:00:00"
          nowIndicator={true}
          scrollTime="06:00:00"
        />
      </div>

      {noteEntry && (
        <EntryDetailModal
          entry={noteEntry}
          onClose={() => setNoteEntry(null)}
          onSubmitNote={handleSubmitNote}
        />
      )}

      {/* User event create / edit modal */}
      {eventModal && (
        <EventModal
          mode={eventModal.mode}
          date={eventModal.mode === 'create' ? eventModal.date : eventModal.entry.date}
          initialTime={eventModal.mode === 'create' ? eventModal.time : eventModal.entry.time}
          initialData={eventModal.mode === 'create'
            ? {
                category: 'Life',
                time: eventModal.time,
                title: '',
                notes: '',
                allDay: eventModal.allDay,
                startDate: eventModal.date,
                endDate: eventModal.date,
              }
            : {
                category: eventModal.entry.category,
                time: eventModal.entry.allDay ? undefined : eventModal.entry.time,
                title: eventModal.entry.title,
                notes: eventModal.entry.description ?? '',
                allDay: eventModal.entry.allDay,
                startDate: eventModal.entry.date,
                endDate: eventModal.endDate ?? eventModal.entry.date,
                workoutDetails: eventModal.entry.workoutYaml,
              }}
          onSave={eventModal.mode === 'create' ? handleCreateEvent : handleUpdateEvent}
          onDelete={eventModal.mode === 'edit' ? handleDeleteEvent : undefined}
          onClose={() => setEventModal(null)}
        />
      )}
    </div>
  );
}
