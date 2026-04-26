import { useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg } from '@fullcalendar/core';
import {
  fetchAllPlans,
  submitAthleteNote,
  createEvent,
  updateEvent,
  deleteEvent,
  rescheduleCoachEntry,
} from '../../services/api';
import { parsePlanFile } from '../../services/planParser';
import type { PlanWeek, PlanEntry, Category, WorkoutDetails, UserEventPayload } from '../../types';
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

function replaceEntryInWeeks(
  weeks: PlanWeek[],
  oldDate: string,
  oldEventId: string,
  newEntry: PlanEntry,
): PlanWeek[] {
  const oldMonday = getMondayOf(oldDate);
  const newMonday = getMondayOf(newEntry.date);
  return weeks.map(week => {
    let entries = week.entries;
    if (week.meta.week_start === oldMonday) {
      entries = entries.filter(e => !(e.date === oldDate && e.eventId === oldEventId));
    }
    if (week.meta.week_start === newMonday) {
      if (!entries.some(e => e.eventId === newEntry.eventId)) {
        entries = [...entries, newEntry];
      }
    }
    return entries === week.entries ? week : { ...week, entries };
  });
}

function removeEntryFromWeeks(weeks: PlanWeek[], date: string, eventId: string): PlanWeek[] {
  return weeks.map(week => ({
    ...week,
    entries: week.entries.filter(e => !(e.date === date && e.eventId === eventId)),
  }));
}

type EventModalState =
  | null
  | { mode: 'create'; date: string; time: string }
  | { mode: 'edit'; entry: PlanEntry };

export default function CalendarPage() {
  const [weeks, setWeeks] = useState<PlanWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Coach-entry note modal
  const [noteEntry, setNoteEntry] = useState<PlanEntry | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [actualDuration, setActualDuration] = useState('');
  const [freshness, setFreshness] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [rpe, setRpe] = useState('');
  const [stats, setStats] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // User-event CRUD modal
  const [eventModal, setEventModal] = useState<EventModalState>(null);

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const planFiles = await fetchAllPlans();
      const parsed = planFiles.map(f => parsePlanFile(f.content, f.filename));
      setWeeks(parsed);
      setError(null);
    } catch (err) {
      console.error('Failed to load plans:', err);
      setError('Failed to load plan files. Check your backend connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const fcEvents = weeks.flatMap(week =>
    week.entries
      .filter(e => e.time !== 'REST')
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

  const handleEventClick = (clickInfo: EventClickArg) => {
    const entry = clickInfo.event.extendedProps.entry as PlanEntry;
    if (entry.eventId) {
      setEventModal({ mode: 'edit', entry });
    } else {
      setNoteEntry(entry);
      setNoteInput('');
      setActualDuration('');
      setFreshness('');
      setDifficulty('');
      setRpe('');
      setStats('');
      setSubmitMessage(null);
    }
  };

  const handleDateClick = (info: { date: Date; allDay: boolean }) => {
    const date = dateFromStart(info.date);
    const time = info.allDay ? '09:00' : timeFromStart(info.date);
    setEventModal({ mode: 'create', date, time });
  };

  const handleEventDrop = async (dropInfo: EventDropArg) => {
    const entry = dropInfo.event.extendedProps.entry as PlanEntry;
    const newStart = dropInfo.event.start!;
    const newDate = dateFromStart(newStart);
    const newTime = dropInfo.event.allDay ? entry.time : timeFromStart(newStart);

    // Cross-week drops are not supported
    if (getMondayOf(newDate) !== getMondayOf(entry.date)) {
      dropInfo.revert();
      return;
    }

    try {
      if (entry.eventId) {
        // ── User-created event ──────────────────────────────────────────────
        let resultEntry: PlanEntry;
        if (newDate === entry.date) {
          const result = await updateEvent(entry.date, entry.eventId, { time: newTime });
          resultEntry = { ...entry, time: result.time };
        } else {
          await deleteEvent(entry.date, entry.eventId);
          const result = await createEvent(newDate, {
            time: newTime,
            category: entry.category as 'Life' | 'Work' | 'Workout',
            title: entry.title,
            notes: entry.description || undefined,
            workout_details: entry.workoutYaml,
          });
          resultEntry = { ...entry, date: newDate, time: result.time, eventId: result.event_id };
        }
        setWeeks(prev => replaceEntryInWeeks(prev, entry.date, entry.eventId!, resultEntry));
      } else {
        // ── Coach-written entry ─────────────────────────────────────────────
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
    const { date } = eventModal;
    const monday = getMondayOf(date);
    const weekExists = weeks.some(w => w.meta.week_start === monday);

    const result = await createEvent(date, payload);

    if (!weekExists) {
      // Week was auto-generated — reload all plans so the new week appears
      await loadPlans();
    } else {
      const newEntry: PlanEntry = {
        eventId: result.event_id,
        time: result.time,
        category: result.category as Category,
        title: result.title,
        description: result.notes ?? '',
        workoutYaml: (result.workout_details as WorkoutDetails) ?? undefined,
        athleteNotes: [],
        date,
      };
      setWeeks(prev => prev.map(week =>
        week.meta.week_start === monday
          ? { ...week, entries: [...week.entries, newEntry] }
          : week
      ));
    }
    setEventModal(null);
  };

  const handleUpdateEvent = async (payload: UserEventPayload) => {
    if (eventModal?.mode !== 'edit') return;
    const { entry } = eventModal;
    const result = await updateEvent(entry.date, entry.eventId!, payload);
    const updatedEntry: PlanEntry = {
      ...entry,
      time: result.time,
      category: result.category as Category,
      title: result.title,
      description: result.notes ?? '',
      workoutYaml: (result.workout_details as WorkoutDetails) ?? undefined,
    };
    setWeeks(prev => replaceEntryInWeeks(prev, entry.date, entry.eventId!, updatedEntry));
    setEventModal(null);
  };

  const handleDeleteEvent = async () => {
    if (eventModal?.mode !== 'edit') return;
    const { entry } = eventModal;
    await deleteEvent(entry.date, entry.eventId!);
    setWeeks(prev => removeEntryFromWeeks(prev, entry.date, entry.eventId!));
    setEventModal(null);
  };

  const handleSubmitNote = async () => {
    if (!noteEntry) return;
    const originalWeeks = weeks;
    const originalEntry = noteEntry;

    const userProvidedNote = noteInput.trim();
    const hasExistingNotes = (noteEntry.athleteNotes || []).length > 0;
    const shouldSendNote = userProvidedNote || !hasExistingNotes;

    const noteToSend = userProvidedNote ||
      (shouldSendNote ? (noteEntry.category === 'Workout' ? 'Workout stats' : 'Rest day stats') : undefined);

    const metadata: Record<string, unknown> = {};
    if (actualDuration) metadata.actual_duration = parseInt(actualDuration, 10);
    if (freshness) metadata.freshness = parseInt(freshness, 10);
    if (difficulty) metadata.difficulty = parseInt(difficulty, 10);
    if (rpe) metadata.rpe = parseInt(rpe, 10);
    if (stats) metadata.stats = stats;

    const hasMetadata = Object.keys(metadata).length > 0;
    if (!noteToSend && !hasMetadata) return;

    setNoteInput('');
    setActualDuration('');
    setFreshness('');
    setDifficulty('');
    setRpe('');
    setStats('');
    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const result = await submitAthleteNote(
        noteEntry.date,
        noteToSend,
        hasMetadata
          ? (metadata as { actual_duration?: number; freshness?: number; difficulty?: number; rpe?: number; stats?: string })
          : undefined
      );

      if (result.note_content !== undefined) {
        const applyNote = (e: PlanEntry) =>
          e.date === originalEntry.date && e.title === originalEntry.title
            ? { ...e, athleteNotes: [result.note_content!] }
            : e;
        const updatedWeeks = weeks.map(week => ({ ...week, entries: week.entries.map(applyNote) }));
        setWeeks(updatedWeeks);
        const updatedEntry = updatedWeeks.flatMap(w => w.entries)
          .find(e => e.date === originalEntry.date && e.title === originalEntry.title);
        if (updatedEntry) setNoteEntry(updatedEntry);
      }

      setSubmitMessage({ type: 'success', text: 'Note submitted!' });
    } catch (err) {
      setWeeks(originalWeeks);
      setNoteEntry(originalEntry);
      setSubmitMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to submit note' });
    } finally {
      setSubmitting(false);
    }
  };

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
        <h2>Training Calendar</h2>
        <p className="page-subtitle">
          {weeks.length} week{weeks.length !== 1 ? 's' : ''} loaded &mdash; click a time slot to add an event
        </p>
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
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          editable={true}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          dateClick={handleDateClick}
          events={fcEvents}
          height="auto"
          eventDisplay="block"
          slotMinTime="05:00:00"
          slotMaxTime="23:00:00"
          nowIndicator={true}
          scrollTime="06:00:00"
        />
      </div>

      {/* Coach-entry modal: view details + add athlete note */}
      {noteEntry && (
        <div className="modal-overlay" onClick={() => setNoteEntry(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{noteEntry.category}: {noteEntry.title}</h3>
            <p className="entry-meta">{noteEntry.date} at {noteEntry.time}</p>

            {noteEntry.description && (
              <div className="entry-description">{noteEntry.description}</div>
            )}

            {noteEntry.workoutYaml && (
              <div className="workout-details">
                <p><strong>Type:</strong> {noteEntry.workoutYaml.type}</p>
                <p><strong>Duration:</strong> {noteEntry.workoutYaml.duration_minutes} min</p>
                <p><strong>Intensity:</strong> {noteEntry.workoutYaml.intensity}</p>
                {noteEntry.workoutYaml.tss_planned != null && (
                  <p><strong>TSS:</strong> {noteEntry.workoutYaml.tss_planned}</p>
                )}
                {noteEntry.workoutYaml.structure && (
                  <div className="workout-structure">
                    <strong>Structure:</strong>
                    <ul>
                      {noteEntry.workoutYaml.structure.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {noteEntry.workoutYaml.notes && (
                  <p className="workout-notes">{noteEntry.workoutYaml.notes}</p>
                )}
              </div>
            )}

            {noteEntry.athleteNotes.length > 0 && (
              <div className="athlete-notes">
                <strong>My Notes:</strong>
                {noteEntry.athleteNotes.map((note, i) => (
                  <blockquote key={i}>{note}</blockquote>
                ))}
              </div>
            )}

            <div className="note-form">
              <label htmlFor="note-input">Your Notes:</label>
              <textarea
                id="note-input"
                placeholder="How did this go? (optional)"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                rows={3}
                disabled={submitting}
              />

              <div className="metadata-grid">
                <div className="form-group">
                  <label htmlFor="actual-duration">Actual Duration (min)</label>
                  <input id="actual-duration" type="number" placeholder="77" value={actualDuration} onChange={e => setActualDuration(e.target.value)} disabled={submitting} />
                </div>
                <div className="form-group">
                  <label htmlFor="freshness">Freshness (1-10)</label>
                  <input id="freshness" type="number" min="1" max="10" placeholder="8" value={freshness} onChange={e => setFreshness(e.target.value)} disabled={submitting} />
                </div>
                <div className="form-group">
                  <label htmlFor="difficulty">Difficulty (1-10)</label>
                  <input id="difficulty" type="number" min="1" max="10" placeholder="7" value={difficulty} onChange={e => setDifficulty(e.target.value)} disabled={submitting} />
                </div>
                <div className="form-group">
                  <label htmlFor="rpe">RPE (1-10)</label>
                  <input id="rpe" type="number" min="1" max="10" placeholder="7" value={rpe} onChange={e => setRpe(e.target.value)} disabled={submitting} />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="stats">Stats / Other Data</label>
                  <input id="stats" type="text" placeholder="e.g., 203W avg, HR 145" value={stats} onChange={e => setStats(e.target.value)} disabled={submitting} />
                </div>
              </div>

              {submitMessage && (
                <p className={`submit-message ${submitMessage.type}`}>{submitMessage.text}</p>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn-primary"
                onClick={handleSubmitNote}
                disabled={submitting || !noteEntry || (!noteInput.trim() && !actualDuration && !freshness && !difficulty && !rpe && !stats)}
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
              <button className="btn-ghost" onClick={() => setNoteEntry(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* User event create / edit modal */}
      {eventModal && (
        <EventModal
          mode={eventModal.mode}
          date={eventModal.mode === 'create' ? eventModal.date : eventModal.entry.date}
          initialTime={eventModal.mode === 'create' ? eventModal.time : eventModal.entry.time}
          initialData={eventModal.mode === 'edit' ? {
            category: eventModal.entry.category as 'Life' | 'Work' | 'Workout',
            time: eventModal.entry.time,
            title: eventModal.entry.title,
            notes: eventModal.entry.description ?? '',
            workoutDetails: eventModal.entry.workoutYaml,
          } : undefined}
          onSave={eventModal.mode === 'create' ? handleCreateEvent : handleUpdateEvent}
          onDelete={eventModal.mode === 'edit' ? handleDeleteEvent : undefined}
          onClose={() => setEventModal(null)}
        />
      )}
    </div>
  );
}
