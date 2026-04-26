import { useEffect, useState } from 'react';
import type { PlanEntry } from '../../types';
import type { EntryDetailModalNotePayload } from './entryNoteUtils';
import './EntryDetailModal.css';

interface EntryDetailModalProps {
  entry: PlanEntry;
  onClose: () => void;
  onSubmitNote?: (payload: EntryDetailModalNotePayload) => Promise<void>;
}

function formatEntryMeta(entry: PlanEntry): string {
  if (entry.allDay) {
    return `${entry.date} · All day`;
  }

  return `${entry.date} at ${entry.time}`;
}

export default function EntryDetailModal({ entry, onClose, onSubmitNote }: EntryDetailModalProps) {
  const [noteInput, setNoteInput] = useState('');
  const [actualDuration, setActualDuration] = useState('');
  const [freshness, setFreshness] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [rpe, setRpe] = useState('');
  const [stats, setStats] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setNoteInput('');
    setActualDuration('');
    setFreshness('');
    setDifficulty('');
    setRpe('');
    setStats('');
    setSubmitMessage(null);
  }, [entry.category, entry.date, entry.time, entry.title]);

  const canSubmit = Boolean(noteInput.trim() || actualDuration || freshness || difficulty || rpe || stats);

  async function handleSubmit() {
    if (!onSubmitNote || !canSubmit) {
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      await onSubmitNote({
        note: noteInput,
        actualDuration,
        freshness,
        difficulty,
        rpe,
        stats,
      });
      setNoteInput('');
      setActualDuration('');
      setFreshness('');
      setDifficulty('');
      setRpe('');
      setStats('');
      setSubmitMessage({ type: 'success', text: 'Note submitted!' });
    } catch (error) {
      setSubmitMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to submit note',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="entry-detail-overlay" onClick={onClose}>
      <div className="entry-detail-modal" onClick={event => event.stopPropagation()}>
        <h3>{entry.category}: {entry.title}</h3>
        <p className="entry-detail-meta">{formatEntryMeta(entry)}</p>

        {entry.description.trim() && (
          <div className="entry-detail-description">{entry.description.trim()}</div>
        )}

        {entry.workoutYaml && (
          <div className="entry-detail-workout">
            {entry.workoutYaml.type && (
              <p><strong>Type:</strong> {entry.workoutYaml.type}</p>
            )}
            {entry.workoutYaml.duration_minutes != null && (
              <p><strong>Duration:</strong> {entry.workoutYaml.duration_minutes} min</p>
            )}
            {entry.workoutYaml.intensity && (
              <p><strong>Intensity:</strong> {entry.workoutYaml.intensity}</p>
            )}
            {entry.workoutYaml.tss_planned != null && (
              <p><strong>TSS:</strong> {entry.workoutYaml.tss_planned}</p>
            )}
            {entry.workoutYaml.structure && (
              <div className="entry-detail-structure">
                <strong>Structure:</strong>
                <ul>
                  {entry.workoutYaml.structure.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
            {entry.workoutYaml.notes && (
              <p className="entry-detail-workout-notes">{entry.workoutYaml.notes}</p>
            )}
          </div>
        )}

        {entry.athleteNotes.length > 0 && (
          <div className="entry-detail-athlete-notes">
            <strong>My Notes:</strong>
            {entry.athleteNotes.map((note, index) => (
              <blockquote key={index}>{note}</blockquote>
            ))}
          </div>
        )}

        {onSubmitNote && (
          <div className="entry-detail-note-form">
            <label htmlFor="entry-note-input">Your Notes:</label>
            <textarea
              id="entry-note-input"
              placeholder="How did this go? (optional)"
              value={noteInput}
              onChange={event => setNoteInput(event.target.value)}
              rows={3}
              disabled={submitting}
            />

            <div className="entry-detail-grid">
              <div className="entry-detail-field">
                <label htmlFor="entry-actual-duration">Actual Duration (min)</label>
                <input
                  id="entry-actual-duration"
                  type="number"
                  placeholder="77"
                  value={actualDuration}
                  onChange={event => setActualDuration(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="entry-detail-field">
                <label htmlFor="entry-freshness">Freshness (1-10)</label>
                <input
                  id="entry-freshness"
                  type="number"
                  min="1"
                  max="10"
                  placeholder="8"
                  value={freshness}
                  onChange={event => setFreshness(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="entry-detail-field">
                <label htmlFor="entry-difficulty">Difficulty (1-10)</label>
                <input
                  id="entry-difficulty"
                  type="number"
                  min="1"
                  max="10"
                  placeholder="7"
                  value={difficulty}
                  onChange={event => setDifficulty(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="entry-detail-field">
                <label htmlFor="entry-rpe">RPE (1-10)</label>
                <input
                  id="entry-rpe"
                  type="number"
                  min="1"
                  max="10"
                  placeholder="7"
                  value={rpe}
                  onChange={event => setRpe(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="entry-detail-field entry-detail-field--full">
                <label htmlFor="entry-stats">Stats / Other Data</label>
                <input
                  id="entry-stats"
                  type="text"
                  placeholder="e.g., 203W avg, HR 145"
                  value={stats}
                  onChange={event => setStats(event.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            {submitMessage && (
              <p className={`entry-detail-message ${submitMessage.type}`}>{submitMessage.text}</p>
            )}
          </div>
        )}

        <div className="entry-detail-actions">
          {onSubmitNote && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleSubmit()}
              disabled={submitting || !canSubmit}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}