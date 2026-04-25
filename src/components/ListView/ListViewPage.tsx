import { useState, useEffect, useCallback } from 'react';
import { fetchAllPlans } from '../../services/api';
import { parsePlanFile } from '../../services/planParser';
import type { PlanWeek, PlanEntry, Category } from '../../types';
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

function EntryCard({ entry }: { entry: PlanEntry }) {
  const [open, setOpen] = useState(false);
  const color = CATEGORY_COLORS[entry.category] ?? '#3b82f6';
  const hasBody =
    entry.description.trim().length > 0 ||
    entry.workoutYaml != null ||
    entry.athleteNotes.length > 0;

  return (
    <div className="lv-entry" style={{ borderLeftColor: color }}>
      <button
        className="lv-entry-header"
        onClick={() => setOpen(o => !o)}
        disabled={!hasBody}
        aria-expanded={hasBody ? open : undefined}
      >
        <span className="lv-entry-time">{entry.time}</span>
        <span
          className="lv-category-pill"
          style={{ background: color + '22', color }}
        >
          {entry.category}
        </span>
        <span className="lv-entry-title">{entry.title}</span>
        {hasBody && <span className="lv-chevron">{open ? '▲' : '▼'}</span>}
      </button>

      {open && hasBody && (
        <div className="lv-entry-body">
          {entry.description.trim() && (
            <p className="lv-description">{entry.description.trim()}</p>
          )}
          {entry.workoutYaml && (
            <div className="lv-workout-chips">
              {entry.workoutYaml.type && (
                <span className="lv-chip">{entry.workoutYaml.type}</span>
              )}
              {entry.workoutYaml.duration_minutes != null && (
                <span className="lv-chip">{entry.workoutYaml.duration_minutes} min</span>
              )}
              {entry.workoutYaml.intensity && (
                <span className="lv-chip">{entry.workoutYaml.intensity}</span>
              )}
              {entry.workoutYaml.tss_planned != null && (
                <span className="lv-chip">TSS {entry.workoutYaml.tss_planned}</span>
              )}
              {entry.workoutYaml.notes && (
                <p className="lv-workout-note">{entry.workoutYaml.notes}</p>
              )}
            </div>
          )}
          {entry.athleteNotes.map((note, i) => (
            <blockquote key={i} className="lv-athlete-note">
              <span className="lv-note-label">Your note</span>
              <p>{note}</p>
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ListViewPage() {
  const [weeks, setWeeks] = useState<PlanWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOption>('All');

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const files = await fetchAllPlans();
      const parsed = files
        .map(f => parsePlanFile(f.content, f.filename))
        .sort((a, b) => a.meta.week_start.localeCompare(b.meta.week_start));
      setWeeks(parsed);
      setError(null);
    } catch (err) {
      console.error('Failed to load plans:', err);
      setError('Failed to load plans. Check your backend connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

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
                        <EntryCard key={`${entry.date}-${entry.time}-${i}`} entry={entry} />
                      )
                    )}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
