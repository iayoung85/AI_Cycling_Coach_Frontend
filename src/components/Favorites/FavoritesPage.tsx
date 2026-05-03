import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createFavorite,
  deleteFavorite,
  fetchFavorites,
  scheduleFavorite,
  updateFavorite,
} from '../../services/api';
import type {
  FavoriteSchedulePayload,
  FavoriteWorkout,
  FavoriteWorkoutCategory,
  FavoriteWorkoutPayload,
  WorkoutDetails,
} from '../../types';
import './FavoritesPage.css';

const DEFAULT_CATEGORIES: FavoriteWorkoutCategory[] = [
  'off-bike',
  'FTP',
  'endurance',
  'HIIT',
  'VO2-max',
  'uncategorized',
  'misc',
];

const CATEGORY_TINTS: Record<FavoriteWorkoutCategory, string> = {
  'off-bike': '#f97316',
  FTP: '#ef4444',
  endurance: '#22c55e',
  HIIT: '#06b6d4',
  'VO2-max': '#8b5cf6',
  uncategorized: '#64748b',
  misc: '#f59e0b',
};

interface FavoriteFormState {
  title: string;
  category: FavoriteWorkoutCategory;
  notes: string;
  type: string;
  durationMinutes: string;
  intensity: string;
  tssPlanned: string;
  structure: string;
  workoutNotes: string;
}

interface ScheduleFormState {
  date: string;
  allDay: boolean;
  time: string;
}

function blankFavoriteForm(): FavoriteFormState {
  return {
    title: '',
    category: 'uncategorized',
    notes: '',
    type: '',
    durationMinutes: '',
    intensity: '',
    tssPlanned: '',
    structure: '',
    workoutNotes: '',
  };
}

function favoriteToFormState(favorite?: FavoriteWorkout | null): FavoriteFormState {
  if (!favorite) {
    return blankFavoriteForm();
  }

  return {
    title: favorite.title,
    category: favorite.category,
    notes: favorite.notes ?? '',
    type: favorite.workout_details?.type ?? '',
    durationMinutes: favorite.workout_details?.duration_minutes?.toString() ?? '',
    intensity: favorite.workout_details?.intensity ?? '',
    tssPlanned: favorite.workout_details?.tss_planned?.toString() ?? '',
    structure: favorite.workout_details?.structure?.join('\n') ?? '',
    workoutNotes: favorite.workout_details?.notes ?? '',
  };
}

function favoriteFormToPayload(form: FavoriteFormState): FavoriteWorkoutPayload {
  const structure = form.structure
    .split('\n')
    .map(step => step.trim())
    .filter(Boolean);

  const workoutDetails: Partial<WorkoutDetails> = {
    type: form.type.trim() || undefined,
    duration_minutes: form.durationMinutes ? Number.parseInt(form.durationMinutes, 10) : undefined,
    intensity: form.intensity || undefined,
    tss_planned: form.tssPlanned ? Number.parseInt(form.tssPlanned, 10) : undefined,
    structure: structure.length > 0 ? structure : undefined,
    notes: form.workoutNotes.trim() || undefined,
  };

  return {
    category: form.category,
    title: form.title.trim(),
    notes: form.notes.trim() || undefined,
    workout_details: Object.values(workoutDetails).some(value => value != null)
      ? workoutDetails
      : undefined,
  };
}

function defaultScheduleForm(): ScheduleFormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    allDay: false,
    time: '07:00',
  };
}

function formatWorkoutSummary(workoutDetails: Partial<WorkoutDetails> | null | undefined): string | null {
  if (!workoutDetails) {
    return null;
  }

  const summary = [
    workoutDetails.type,
    workoutDetails.duration_minutes != null ? `${workoutDetails.duration_minutes} min` : null,
    workoutDetails.intensity,
    workoutDetails.tss_planned != null ? `${workoutDetails.tss_planned} TSS` : null,
  ].filter(Boolean);

  return summary.length > 0 ? summary.join(' • ') : null;
}

function FavoriteFormFields({
  form,
  onChange,
}: {
  form: FavoriteFormState;
  onChange: React.Dispatch<React.SetStateAction<FavoriteFormState>>;
}) {
  return (
    <div className="favorites-form-grid">
      <div className="form-group favorites-form-group favorites-form-group--full">
        <label htmlFor="favorite-title">Title</label>
        <input
          id="favorite-title"
          type="text"
          value={form.title}
          onChange={(event) => onChange(current => ({ ...current, title: event.target.value }))}
          placeholder="Threshold Builder"
        />
      </div>

      <div className="form-group favorites-form-group">
        <label htmlFor="favorite-category">Category Folder</label>
        <select
          id="favorite-category"
          value={form.category}
          onChange={(event) => onChange(current => ({
            ...current,
            category: event.target.value as FavoriteWorkoutCategory,
          }))}
        >
          {DEFAULT_CATEGORIES.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      <div className="form-group favorites-form-group">
        <label htmlFor="favorite-type">Workout Type</label>
        <input
          id="favorite-type"
          type="text"
          value={form.type}
          onChange={(event) => onChange(current => ({ ...current, type: event.target.value }))}
          placeholder="ride, run, strength"
        />
      </div>

      <div className="form-group favorites-form-group favorites-form-group--full">
        <label htmlFor="favorite-notes">Entry Notes</label>
        <textarea
          id="favorite-notes"
          rows={3}
          value={form.notes}
          onChange={(event) => onChange(current => ({ ...current, notes: event.target.value }))}
          placeholder="Why this workout matters, when to use it, reminders..."
        />
      </div>

      <div className="form-group favorites-form-group">
        <label htmlFor="favorite-duration">Duration (min)</label>
        <input
          id="favorite-duration"
          type="number"
          value={form.durationMinutes}
          onChange={(event) => onChange(current => ({ ...current, durationMinutes: event.target.value }))}
          placeholder="75"
        />
      </div>

      <div className="form-group favorites-form-group">
        <label htmlFor="favorite-intensity">Intensity</label>
        <select
          id="favorite-intensity"
          value={form.intensity}
          onChange={(event) => onChange(current => ({ ...current, intensity: event.target.value }))}
        >
          <option value="">Select…</option>
          <option value="easy">Easy</option>
          <option value="moderate">Moderate</option>
          <option value="hard">Hard</option>
          <option value="threshold">Threshold</option>
          <option value="VO2max">VO2max</option>
        </select>
      </div>

      <div className="form-group favorites-form-group">
        <label htmlFor="favorite-tss">TSS</label>
        <input
          id="favorite-tss"
          type="number"
          value={form.tssPlanned}
          onChange={(event) => onChange(current => ({ ...current, tssPlanned: event.target.value }))}
          placeholder="82"
        />
      </div>

      <div className="form-group favorites-form-group favorites-form-group--full">
        <label htmlFor="favorite-structure">Structure</label>
        <textarea
          id="favorite-structure"
          rows={5}
          value={form.structure}
          onChange={(event) => onChange(current => ({ ...current, structure: event.target.value }))}
          placeholder="One step per line"
        />
      </div>

      <div className="form-group favorites-form-group favorites-form-group--full">
        <label htmlFor="favorite-workout-notes">Workout Notes</label>
        <textarea
          id="favorite-workout-notes"
          rows={4}
          value={form.workoutNotes}
          onChange={(event) => onChange(current => ({ ...current, workoutNotes: event.target.value }))}
          placeholder="Targets, execution cues, terrain, fueling reminders..."
        />
      </div>
    </div>
  );
}

function FavoriteEditorModal({
  favorite,
  saving,
  error,
  onClose,
  onSave,
}: {
  favorite: FavoriteWorkout | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: FavoriteWorkoutPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<FavoriteFormState>(() => favoriteToFormState(favorite));

  useEffect(() => {
    setForm(favoriteToFormState(favorite));
  }, [favorite]);

  const title = favorite ? 'Edit Favorite Workout' : 'New Favorite Workout';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSave(favoriteFormToPayload(form));
  }

  return (
    <div className="favorites-modal-overlay" onClick={onClose}>
      <div
        className="favorites-modal favorites-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="favorite-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="favorite-editor-title">{title}</h3>
        <form onSubmit={handleSubmit}>
          <FavoriteFormFields form={form} onChange={setForm} />
          {error && <p className="favorites-message favorites-message--error">{error}</p>}
          <div className="favorites-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving || !form.title.trim()}>
              {saving ? 'Saving…' : favorite ? 'Save Favorite' : 'Create Favorite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FavoriteScheduleModal({
  favorite,
  saving,
  error,
  success,
  onClose,
  onSchedule,
}: {
  favorite: FavoriteWorkout;
  saving: boolean;
  error: string | null;
  success: string | null;
  onClose: () => void;
  onSchedule: (payload: FavoriteSchedulePayload) => Promise<void>;
}) {
  const [form, setForm] = useState<ScheduleFormState>(defaultScheduleForm());

  useEffect(() => {
    setForm(defaultScheduleForm());
  }, [favorite.id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSchedule({
      date: form.date,
      time: form.allDay ? undefined : form.time,
      all_day: form.allDay,
    });
  }

  return (
    <div className="favorites-modal-overlay" onClick={onClose}>
      <div
        className="favorites-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="favorite-schedule-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="favorite-schedule-title">Schedule From Favorite</h3>
        <p className="favorites-modal-meta">{favorite.title}</p>
        <form onSubmit={handleSubmit}>
          <div className="favorites-form-grid favorites-form-grid--compact">
            <div className="form-group favorites-form-group">
              <label htmlFor="favorite-schedule-date">Day</label>
              <input
                id="favorite-schedule-date"
                type="date"
                value={form.date}
                onChange={(event) => setForm(current => ({ ...current, date: event.target.value }))}
              />
            </div>

            <div className="form-group favorites-form-group">
              <label htmlFor="favorite-schedule-time">Time</label>
              <input
                id="favorite-schedule-time"
                type="time"
                value={form.time}
                disabled={form.allDay}
                onChange={(event) => setForm(current => ({ ...current, time: event.target.value }))}
              />
            </div>

            <label className="favorites-checkbox">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(event) => setForm(current => ({ ...current, allDay: event.target.checked }))}
              />
              <span>Schedule as all-day workout</span>
            </label>
          </div>

          {error && <p className="favorites-message favorites-message--error">{error}</p>}
          {success && <p className="favorites-message favorites-message--success">{success}</p>}

          <div className="favorites-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              Close
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Scheduling…' : 'Schedule Workout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteWorkout[]>([]);
  const [categories, setCategories] = useState<FavoriteWorkoutCategory[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorFavorite, setEditorFavorite] = useState<FavoriteWorkout | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [scheduleFavoriteTarget, setScheduleFavoriteTarget] = useState<FavoriteWorkout | null>(null);
  const [draggingFavoriteId, setDraggingFavoriteId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<FavoriteWorkoutCategory | null>(null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DEFAULT_CATEGORIES.map(category => [category, true]))
  );
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchFavorites();
      setFavorites(data.favorites);
      setCategories((data.categories as FavoriteWorkoutCategory[]) ?? DEFAULT_CATEGORIES);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load favorites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  const groupedFavorites = useMemo(() => {
    const next = new Map<FavoriteWorkoutCategory, FavoriteWorkout[]>();

    for (const category of categories) {
      next.set(category, []);
    }

    for (const favorite of favorites) {
      const bucket = next.get(favorite.category as FavoriteWorkoutCategory) ?? [];
      bucket.push(favorite);
      next.set(favorite.category as FavoriteWorkoutCategory, bucket);
    }

    for (const [category, group] of next.entries()) {
      next.set(category, [...group].sort((left, right) => left.title.localeCompare(right.title)));
    }

    return next;
  }, [categories, favorites]);

  async function handleSaveFavorite(payload: FavoriteWorkoutPayload) {
    try {
      setEditorSaving(true);
      setEditorError(null);

      if (editorFavorite) {
        const updated = await updateFavorite(editorFavorite.id, payload);
        setFavorites(current => current.map(favorite => favorite.id === updated.id ? updated : favorite));
      } else {
        const created = await createFavorite(payload);
        setFavorites(current => [...current, created]);
      }

      setEditorFavorite(null);
      setShowCreate(false);
    } catch (saveError) {
      setEditorError(saveError instanceof Error ? saveError.message : 'Failed to save favorite');
    } finally {
      setEditorSaving(false);
    }
  }

  async function handleDeleteFavorite(favoriteId: string) {
    try {
      await deleteFavorite(favoriteId);
      setFavorites(current => current.filter(favorite => favorite.id !== favoriteId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete favorite');
    }
  }

  async function handleDropOnCategory(category: FavoriteWorkoutCategory) {
    if (!draggingFavoriteId) {
      return;
    }

    const favorite = favorites.find(item => item.id === draggingFavoriteId);
    setDragOverCategory(null);
    setDraggingFavoriteId(null);

    if (!favorite || favorite.category === category) {
      return;
    }

    try {
      const updated = await updateFavorite(favorite.id, { category });
      setFavorites(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (dropError) {
      setError(dropError instanceof Error ? dropError.message : 'Failed to move favorite');
    }
  }

  async function handleSchedule(payload: FavoriteSchedulePayload) {
    if (!scheduleFavoriteTarget) {
      return;
    }

    try {
      setScheduleSaving(true);
      setScheduleError(null);
      setScheduleMessage(null);
      await scheduleFavorite(scheduleFavoriteTarget.id, payload);
      setScheduleMessage(`Scheduled for ${payload.date}${payload.all_day ? ' (all day)' : ` at ${payload.time}`}.`);
    } catch (scheduleErr) {
      setScheduleError(scheduleErr instanceof Error ? scheduleErr.message : 'Failed to schedule workout');
    } finally {
      setScheduleSaving(false);
    }
  }

  if (loading) {
    return <div className="favorites-page"><p>Loading favorites…</p></div>;
  }

  return (
    <div className="favorites-page">
      <div className="favorites-hero">
        <div>
          <p className="favorites-eyebrow">Reusable workouts</p>
          <h2>Favorites Library</h2>
          <p className="favorites-subtitle">
            Save high-value sessions once, keep them categorized, then drop them back onto the calendar without hunting through old weeks.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setEditorError(null);
            setEditorFavorite(null);
            setShowCreate(true);
          }}
        >
          + Add Favorite
        </button>
      </div>

      {error && <p className="favorites-message favorites-message--error favorites-page-message">{error}</p>}

      <div className="favorites-grid">
        {categories.map(category => {
          const items = groupedFavorites.get(category) ?? [];
          const isOpen = openCategories[category] ?? true;
          const tint = CATEGORY_TINTS[category];

          return (
            <section
              key={category}
              className={`favorites-category${dragOverCategory === category ? ' is-drag-target' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverCategory(category);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  return;
                }
                setDragOverCategory(current => current === category ? null : current);
              }}
              onDrop={(event) => {
                event.preventDefault();
                void handleDropOnCategory(category);
              }}
            >
              <button
                type="button"
                className="favorites-category-header"
                onClick={() => setOpenCategories(current => ({ ...current, [category]: !isOpen }))}
              >
                <span className="favorites-category-marker" style={{ background: tint }} />
                <span className="favorites-category-title">{category}</span>
                <span className="favorites-category-count">{items.length}</span>
                <span className="favorites-category-chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
              </button>

              {isOpen && (
                <div className="favorites-category-body">
                  {items.length === 0 ? (
                    <div className="favorites-empty-folder">Drop a workout here to keep this folder ready.</div>
                  ) : (
                    items.map(favorite => {
                      const summary = formatWorkoutSummary(favorite.workout_details);

                      return (
                        <article
                          key={favorite.id}
                          className="favorite-card"
                          draggable
                          onDragStart={() => setDraggingFavoriteId(favorite.id)}
                          onDragEnd={() => {
                            setDraggingFavoriteId(null);
                            setDragOverCategory(null);
                          }}
                        >
                          <div className="favorite-card-topline">
                            <span className="favorite-card-pill" style={{ color: tint, background: `${tint}1f` }}>
                              {category}
                            </span>
                            {summary && <span className="favorite-card-summary">{summary}</span>}
                          </div>

                          <h3>{favorite.title}</h3>

                          {favorite.notes && <p className="favorite-card-notes">{favorite.notes}</p>}

                          {favorite.workout_details?.structure && favorite.workout_details.structure.length > 0 && (
                            <ul className="favorite-card-structure">
                              {favorite.workout_details.structure.slice(0, 3).map(step => (
                                <li key={step}>{step}</li>
                              ))}
                            </ul>
                          )}

                          <div className="favorite-card-actions">
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => {
                                setScheduleFavoriteTarget(favorite);
                                setScheduleError(null);
                                setScheduleMessage(null);
                              }}
                            >
                              Schedule
                            </button>
                            <button
                              type="button"
                              className="btn-ghost"
                              onClick={() => {
                                setEditorError(null);
                                setShowCreate(false);
                                setEditorFavorite(favorite);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-ghost"
                              onClick={() => void handleDeleteFavorite(favorite.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {showCreate && (
        <FavoriteEditorModal
          favorite={null}
          saving={editorSaving}
          error={editorError}
          onClose={() => {
            setShowCreate(false);
            setEditorError(null);
          }}
          onSave={handleSaveFavorite}
        />
      )}

      {editorFavorite && (
        <FavoriteEditorModal
          favorite={editorFavorite}
          saving={editorSaving}
          error={editorError}
          onClose={() => {
            setEditorFavorite(null);
            setEditorError(null);
          }}
          onSave={handleSaveFavorite}
        />
      )}

      {scheduleFavoriteTarget && (
        <FavoriteScheduleModal
          favorite={scheduleFavoriteTarget}
          saving={scheduleSaving}
          error={scheduleError}
          success={scheduleMessage}
          onClose={() => {
            setScheduleFavoriteTarget(null);
            setScheduleError(null);
            setScheduleMessage(null);
          }}
          onSchedule={handleSchedule}
        />
      )}
    </div>
  );
}