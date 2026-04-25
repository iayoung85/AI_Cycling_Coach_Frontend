import { useState } from 'react';
import type { UserEventPayload, UserEventCategory } from '../../types';

interface InitialEventData {
  category: UserEventCategory;
  time: string;
  title: string;
  notes: string;
  workoutDetails?: {
    type?: string;
    duration_minutes?: number;
    intensity?: string;
    tss_planned?: number;
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
  const [time, setTime] = useState(initialData?.time ?? initialTime);
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');

  // Workout-specific fields
  const [wType, setWType] = useState(initialData?.workoutDetails?.type ?? '');
  const [wDuration, setWDuration] = useState(
    initialData?.workoutDetails?.duration_minutes?.toString() ?? ''
  );
  const [wIntensity, setWIntensity] = useState(initialData?.workoutDetails?.intensity ?? '');
  const [wTss, setWTss] = useState(initialData?.workoutDetails?.tss_planned?.toString() ?? '');
  const [wNotes, setWNotes] = useState(initialData?.workoutDetails?.notes ?? '');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!/^\d{2}:\d{2}$/.test(time)) { setError('Time must be HH:MM'); return; }

    const payload: UserEventPayload = {
      category,
      time,
      title: title.trim(),
      notes: notes.trim() || undefined,
      workout_details: category === 'Workout' ? {
        type: wType || 'ride',
        duration_minutes: parseInt(wDuration) || 60,
        intensity: wIntensity || 'easy',
        tss_planned: wTss ? parseInt(wTss) : undefined,
        notes: wNotes.trim() || undefined,
      } : undefined,
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal event-modal" onClick={e => e.stopPropagation()}>
        <h3>{mode === 'create' ? 'Add Event' : 'Edit Event'}</h3>
        <p className="entry-meta">{date}</p>

        <div className="event-form">
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as UserEventCategory)}
                disabled={saving}
              >
                <option value="Life">Life</option>
                <option value="Work">Work</option>
                <option value="Workout">Workout</option>
              </select>
            </div>
            <div className="form-group">
              <label>Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              placeholder="Event title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              placeholder="Optional description…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              disabled={saving}
            />
          </div>

          {category === 'Workout' && (
            <div className="workout-fields">
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <input
                    type="text"
                    placeholder="ride, run, strength…"
                    value={wType}
                    onChange={e => setWType(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label>Intensity</label>
                  <select
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
                  <label>Duration (min)</label>
                  <input
                    type="number"
                    placeholder="60"
                    value={wDuration}
                    onChange={e => setWDuration(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label>TSS</label>
                  <input
                    type="number"
                    placeholder="50"
                    value={wTss}
                    onChange={e => setWTss(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Workout Notes</label>
                <textarea
                  placeholder="Structure, targets…"
                  value={wNotes}
                  onChange={e => setWNotes(e.target.value)}
                  rows={2}
                  disabled={saving}
                />
              </div>
            </div>
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
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose} disabled={saving || deleting}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || deleting || !title.trim()}>
            {saving ? 'Saving…' : mode === 'create' ? 'Add Event' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
