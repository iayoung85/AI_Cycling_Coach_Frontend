import { useEffect, useState } from 'react';
import { createFavorite, fetchFavorites } from '../../services/api';
import type { FavoriteWorkout, UserEventPayload, UserEventCategory } from '../../types';

interface InitialEventData {
  category: UserEventCategory;
  time?: string;
  title: string;
  notes: string;
  allDay?: boolean;
  startDate?: string;
  endDate?: string;
  workoutDetails?: {
    type?: string;
    duration_minutes?: number;
    intensity?: string;
    tss_planned?: number;
    structure?: string[];
    notes?: string;
  };
}

interface EventModalProps {
  mode: 'create' | 'edit';
  date: string;
  initialTime?: string;
  initialData?: InitialEventData;
  onSave: (payload: UserEventPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export default function EventModal({
  mode,
  date,
  initialTime = '09:00',
  initialData,
  onSave,
  onDelete,
  onClose,
}: EventModalProps) {
  const [category, setCategory] = useState<UserEventCategory>(initialData?.category ?? 'Life');
  const [allDay, setAllDay] = useState(initialData?.allDay ?? false);
  const [startDate, setStartDate] = useState(initialData?.startDate ?? date);
  const [endDate, setEndDate] = useState(initialData?.endDate ?? initialData?.startDate ?? date);
  const [time, setTime] = useState(initialData?.time ?? (initialData?.allDay ? '09:00' : initialTime));
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');

  // Workout-specific fields
  const [wType, setWType] = useState(initialData?.workoutDetails?.type ?? '');
  const [wDuration, setWDuration] = useState(
    initialData?.workoutDetails?.duration_minutes?.toString() ?? ''
  );
  const [wIntensity, setWIntensity] = useState(initialData?.workoutDetails?.intensity ?? '');
  const [wTss, setWTss] = useState(initialData?.workoutDetails?.tss_planned?.toString() ?? '');
  const [wStructure, setWStructure] = useState(initialData?.workoutDetails?.structure?.join('\n') ?? '');
  const [wNotes, setWNotes] = useState(initialData?.workoutDetails?.notes ?? '');
  const [favoriteId, setFavoriteId] = useState('');
  const [favorites, setFavorites] = useState<FavoriteWorkout[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'create') {
      return;
    }

    let active = true;

    async function loadFavorites() {
      try {
        setFavoritesLoading(true);
        const result = await fetchFavorites();
        if (!active) {
          return;
        }
        setFavorites(result.favorites);
        setFavoritesError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setFavoritesError(loadError instanceof Error ? loadError.message : 'Failed to load favorites');
      } finally {
        if (active) {
          setFavoritesLoading(false);
        }
      }
    }

    void loadFavorites();

    return () => {
      active = false;
    };
  }, [mode]);

  function applyFavoriteSelection(selectedFavorite: FavoriteWorkout) {
    setFavoriteId(selectedFavorite.id);
    setTitle(selectedFavorite.title);
    setNotes(selectedFavorite.notes ?? '');
    setWType(selectedFavorite.workout_details?.type ?? '');
    setWDuration(selectedFavorite.workout_details?.duration_minutes?.toString() ?? '');
    setWIntensity(selectedFavorite.workout_details?.intensity ?? '');
    setWTss(selectedFavorite.workout_details?.tss_planned?.toString() ?? '');
    setWStructure(selectedFavorite.workout_details?.structure?.join('\n') ?? '');
    setWNotes(selectedFavorite.workout_details?.notes ?? '');
    setError(null);
  }

  function buildWorkoutPayload() {
    const structure = wStructure
      .split('\n')
      .map(step => step.trim())
      .filter(Boolean);

    return {
      type: wType || 'ride',
      duration_minutes: parseInt(wDuration) || 60,
      intensity: wIntensity || 'easy',
      tss_planned: wTss ? parseInt(wTss) : undefined,
      structure: structure.length > 0 ? structure : undefined,
      notes: wNotes.trim() || undefined,
    };
  }

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) { setError('Start day must be YYYY-MM-DD'); return; }
    if (allDay) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) { setError('End day must be YYYY-MM-DD'); return; }
      if (endDate < startDate) { setError('End day must be on or after start day'); return; }
    } else if (!/^\d{2}:\d{2}$/.test(time)) {
      setError('Time must be HH:MM');
      return;
    }

    const payload: UserEventPayload = {
      category,
      title: title.trim(),
      notes: notes.trim() || undefined,
      all_day: allDay,
      start_date: startDate,
      end_date: allDay ? endDate : startDate,
      time: allDay ? undefined : time,
      workout_details: category === 'Workout' ? buildWorkoutPayload() : undefined,
    };

    setSaving(true);
    setError(null);
    try {
      await onSave(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleting(false);
    }
  };

  const handleAddToFavorites = async () => {
    if (category !== 'Workout') {
      return;
    }
    if (!title.trim()) {
      setFavoriteMessage({ type: 'error', text: 'Title is required to save a favorite.' });
      return;
    }

    setSavingFavorite(true);
    setFavoriteMessage(null);

    try {
      await createFavorite({
        title: title.trim(),
        notes: notes.trim() || undefined,
        workout_details: buildWorkoutPayload(),
      });
      setFavoriteMessage({ type: 'success', text: 'Saved to favorites.' });
    } catch (err) {
      setFavoriteMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save favorite',
      });
    } finally {
      setSavingFavorite(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal event-modal" onClick={e => e.stopPropagation()}>
        <h3>{mode === 'create' ? 'Add Event' : 'Edit Event'}</h3>
        <p className="entry-meta">{date}</p>

        <div className="event-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="event-category">Category</label>
              <select
                id="event-category"
                value={category}
                onChange={e => setCategory(e.target.value as UserEventCategory)}
                disabled={saving}
              >
                <option value="Workout">Workout</option>
                <option value="Life">Life</option>
                <option value="Work">Work</option>
                <option value="Note">Note</option>
                <option value="Checkin">Checkin</option>
              </select>
            </div>
            <div className="form-group checkbox-group">
              <span className="checkbox-label">All-Day Event</span>
              <label className="checkbox-control">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={e => setAllDay(e.target.checked)}
                  disabled={saving}
                />
                <span className="checkbox-copy">
                  <strong>Show in all-day row</strong>
                  <small>Place this event in the calendar&apos;s all-day area.</small>
                </span>
              </label>
            </div>
          </div>

          {allDay ? (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="event-start-day">Start Day</label>
                <input
                  id="event-start-day"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <label htmlFor="event-end-day">End Day</label>
                <input
                  id="event-end-day"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          ) : (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="event-day">Day</label>
                <input
                  id="event-day"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <label htmlFor="event-time">Time</label>
                <input
                  id="event-time"
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="event-title">Title</label>
            <input
              id="event-title"
              type="text"
              placeholder="Event title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="event-notes">Notes</label>
            <textarea
              id="event-notes"
              placeholder="Optional description…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              disabled={saving}
            />
          </div>

          {category === 'Workout' && (
            <div className="workout-fields">
              {mode === 'create' && (
                <div className="form-group">
                  <label htmlFor="event-favorite">Start From Favorite</label>
                  <select
                    id="event-favorite"
                    value={favoriteId}
                    onChange={event => {
                      const nextFavoriteId = event.target.value;
                      setFavoriteId(nextFavoriteId);
                      const selectedFavorite = favorites.find(item => item.id === nextFavoriteId);
                      if (selectedFavorite) {
                        applyFavoriteSelection(selectedFavorite);
                      }
                    }}
                    disabled={saving || favoritesLoading || favorites.length === 0}
                  >
                    <option value="">
                      {favoritesLoading ? 'Loading favorites…' : favorites.length > 0 ? 'Select a saved workout…' : 'No favorites yet'}
                    </option>
                    {favorites.map(favorite => (
                      <option key={favorite.id} value={favorite.id}>
                        {favorite.title} ({favorite.category})
                      </option>
                    ))}
                  </select>
                  {favoritesError && <p className="submit-message error">{favoritesError}</p>}
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="event-workout-type">Type</label>
                  <input
                    id="event-workout-type"
                    type="text"
                    placeholder="ride, run, strength…"
                    value={wType}
                    onChange={e => setWType(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="event-workout-intensity">Intensity</label>
                  <select
                    id="event-workout-intensity"
                    value={wIntensity}
                    onChange={e => setWIntensity(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Select…</option>
                    <option value="easy">Easy</option>
                    <option value="moderate">Moderate</option>
                    <option value="hard">Hard</option>
                    <option value="threshold">Threshold</option>
                    <option value="VO2max">VO2max</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="event-workout-duration">Duration (min)</label>
                  <input
                    id="event-workout-duration"
                    type="number"
                    placeholder="60"
                    value={wDuration}
                    onChange={e => setWDuration(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="event-workout-tss">TSS</label>
                  <input
                    id="event-workout-tss"
                    type="number"
                    placeholder="50"
                    value={wTss}
                    onChange={e => setWTss(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="event-workout-structure">Structure</label>
                <textarea
                  id="event-workout-structure"
                  placeholder="One step per line"
                  value={wStructure}
                  onChange={e => setWStructure(e.target.value)}
                  rows={5}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <label htmlFor="event-workout-notes">Workout Notes</label>
                <textarea
                  id="event-workout-notes"
                  placeholder="Structure, targets…"
                  value={wNotes}
                  onChange={e => setWNotes(e.target.value)}
                  rows={6}
                  disabled={saving}
                />
              </div>
            </div>
          )}

          {favoriteMessage && (
            <p className={`submit-message ${favoriteMessage.type}`}>{favoriteMessage.text}</p>
          )}
          {error && <p className="submit-message error">{error}</p>}
        </div>

        <div className="modal-actions">
          {mode === 'edit' && onDelete && (
            <button
              className="btn-danger"
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          {mode === 'edit' && category === 'Workout' && (
            <button
              className="btn-ghost"
              onClick={handleAddToFavorites}
              disabled={saving || deleting || savingFavorite || !title.trim()}
            >
              {savingFavorite ? 'Saving Favorite…' : 'Add to Favorites'}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose} disabled={saving || deleting || savingFavorite}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || deleting || savingFavorite || !title.trim()}>
            {saving ? 'Saving…' : mode === 'create' ? 'Add Event' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
