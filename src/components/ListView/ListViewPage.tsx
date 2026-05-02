import { useState, useEffect, useCallback } from 'react';
import { fetchAllPlans, submitAthleteNote } from '../../services/api';
import { parsePlanFile } from '../../services/planParser';
import type { PlanWeek, PlanEntry, Category } from '../../types';
import EntryDetailModal from '../EntryDetail/EntryDetailModal';
import {
  applyAthleteNoteToWeeks,
  buildAthleteNoteRequest,
  type EntryDetailModalNotePayload,
} from '../EntryDetail/entryNoteUtils';
import './ListViewPage.css';

type FilterOption = Category | 'All';

const FILTER_OPTIONS: FilterOption[] = ['All', 'Workout', 'Life', 'Work', 'Note', 'Checkin'];

const CATEGORY_COLORS: Record<string, string> = {
  Workout: '#22c55e',
  Life: '#a78bfa',
  Work: '#f59e0b',
  Note: '#3b82f6',
  Checkin: '#06b6d4',
};

function formatDayHeading(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatWeekRange(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function getEntryPreview(entry: PlanEntry): string | null {
  const description = entry.description.trim();

  if (description) {
    return description;
  }

  if (entry.workoutYaml?.notes) {
    return entry.workoutYaml.notes;
  }

  if (entry.workoutYaml?.structure?.length) {
    return entry.workoutYaml.structure[0];
  }

  if (entry.workoutYaml) {
    const summary = [
      entry.workoutYaml.type,
      entry.workoutYaml.duration_minutes != null ? `${entry.workoutYaml.duration_minutes} min` : null,
      entry.workoutYaml.intensity,
    ].filter(Boolean);

    if (summary.length > 0) {
      return summary.join(' • ');
    }
  }

  if (entry.athleteNotes.length > 0) {
    return 'Includes your notes';
  }

  return null;
}

function EntryCard({ entry, onSelect }: { entry: PlanEntry; onSelect: (entry: PlanEntry) => void }) {
  const color = CATEGORY_COLORS[entry.category] ?? '#3b82f6';
  const preview = getEntryPreview(entry);
  const timeLabel = entry.allDay ? 'All Day' : entry.time;

  return (
    <button
      type="button"
      className="lv-entry"
      style={{ borderLeftColor: color }}
      onClick={() => onSelect(entry)}
    >
      <div className="lv-entry-header">
        <span className="lv-entry-time">{timeLabel}</span>
        <span
          className="lv-category-pill"
          style={{ background: color + '22', color }}
        >
          {entry.category}
        </span>
        <span className="lv-entry-title">{entry.title}</span>
        <span className="lv-chevron" aria-hidden="true">Open</span>
      </div>
      {preview && <p className="lv-entry-preview">{preview}</p>}
    </button>
  );
}

export default function ListViewPage() {
  const [weeks, setWeeks] = useState<PlanWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOption>('All');
  const [selectedEntry, setSelectedEntry] = useState<PlanEntry | null>(null);

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const { plans: files, syncWarning: warning } = await fetchAllPlans();
      const parsed = files
        .map(f => parsePlanFile(f.content, f.filename))
        .sort((a, b) => a.meta.week_start.localeCompare(b.meta.week_start));
      setWeeks(parsed);
      setError(null);
      setSyncWarning(warning ?? null);
    } catch (err) {
      console.error('Failed to load plans:', err);
      setError('Failed to load plans. Check your backend connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const handleSubmitNote = async (payload: EntryDetailModalNotePayload) => {
    if (!selectedEntry || selectedEntry.eventId) {
      return;
    }

    const { noteToSend, metadata } = buildAthleteNoteRequest(selectedEntry, payload);

    if (!noteToSend && !metadata) {
      return;
    }

    try {
      const result = await submitAthleteNote(selectedEntry.date, noteToSend, metadata);

      if (result.note_content !== undefined) {
        const { weeks: updatedWeeks, updatedEntry } = applyAthleteNoteToWeeks(weeks, selectedEntry, result.note_content);
        setWeeks(updatedWeeks);
        if (updatedEntry) {
          setSelectedEntry(updatedEntry);
        }
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to submit note');
    }
  };

  // Group entries by date, applying category filter (REST entries only shown when filter is 'All')
  const visibleWeeks = weeks
    .map(week => {
      const filteredEntries =
        filter === 'All'
          ? week.entries
          : week.entries.filter(e => e.category === filter);

      const byDate = new Map<string, PlanEntry[]>();
      for (const entry of filteredEntries) {
        const arr = byDate.get(entry.date) ?? [];
        arr.push(entry);
        byDate.set(entry.date, arr);
      }
      return { week, byDate };
    })
    .filter(({ byDate }) => byDate.size > 0);

  if (loading) return <div className="lv-state">Loading plans…</div>;
  if (error) return <div className="lv-state lv-state--error">{error}</div>;

  return (
    <div className="lv-page">
      {syncWarning && (
        <div className="sync-warning-banner">
          ⚠️ Repo sync issue — plans may be stale. Check for unpushed local commits or merge conflicts: <em>{syncWarning}</em>
        </div>
      )}
      <div className="lv-header">
        <h2 className="lv-title">Plan</h2>
        <div className="lv-filters" role="group" aria-label="Filter by category">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt}
              className={`lv-filter-btn${filter === opt ? ' active' : ''}`}
              onClick={() => setFilter(opt)}
              style={
                filter === opt && opt !== 'All'
                  ? {
                      background: CATEGORY_COLORS[opt] + '22',
                      color: CATEGORY_COLORS[opt],
                      borderColor: CATEGORY_COLORS[opt],
                    }
                  : {}
              }
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {visibleWeeks.length === 0 ? (
        <div className="lv-state">No entries found.</div>
      ) : (
        <div className="lv-weeks">
          {visibleWeeks.map(({ week, byDate }) => (
            <section key={week.meta.week_start} className="lv-week">
              <div className="lv-week-header">
                <h3 className="lv-week-title">
                  Week {week.meta.week_number}
                  <span className="lv-week-range">{formatWeekRange(week.meta.week_start)}</span>
                </h3>
                {week.meta.training_block && (
                  <span className="lv-week-block">{week.meta.training_block}</span>
                )}
              </div>

              {[...byDate.entries()].map(([date, entries]) => (
                <div key={date} className="lv-day">
                  <h4 className="lv-day-heading">{formatDayHeading(date)}</h4>
                  <div className="lv-day-entries">
                    {entries.map((entry, i) =>
                      entry.time === 'REST' ? (
                        <div key={i} className="lv-rest">Rest Day</div>
                      ) : (
                        <EntryCard
                          key={`${entry.date}-${entry.time}-${i}`}
                          entry={entry}
                          onSelect={setSelectedEntry}
                        />
                      )
                    )}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onSubmitNote={selectedEntry.eventId ? undefined : handleSubmitNote}
        />
      )}
    </div>
  );
}
