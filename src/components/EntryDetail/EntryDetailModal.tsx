import { useEffect, useState } from 'react';
import type { AthleteNoteAction, PlanEntry } from '../../types';
import { parseAthleteNoteForEditing, type EntryDetailModalNotePayload } from './entryNoteUtils';
import './EntryDetailModal.css';

interface EntryDetailModalProps {
  entry: PlanEntry;
  onClose: () => void;
  onSubmitNote?: (payload: EntryDetailModalNotePayload) => Promise<void>;
  onAddToFavorites?: (entry: PlanEntry) => Promise<void>;
}

function formatEntryMeta(entry: PlanEntry): string {
  if (entry.allDay) {
    return `${entry.date} · All day`;
  }

  return `${entry.date} at ${entry.time}`;
}

function getNoteOptionLabel(note: string, index: number): string {
  const parsedNote = parseAthleteNoteForEditing(note);
  const preview = (parsedNote.note || note).replace(/\s+/g, ' ').trim();
  const truncatedPreview = preview.length > 48 ? `${preview.slice(0, 48)}...` : preview;

  return truncatedPreview ? `Note ${index + 1}: ${truncatedPreview}` : `Note ${index + 1}`;
}

export default function EntryDetailModal({
  entry,
  onClose,
  onSubmitNote,
  onAddToFavorites,
}: EntryDetailModalProps) {
  const [noteInput, setNoteInput] = useState('');
  const [actualDuration, setActualDuration] = useState('');
  const [freshness, setFreshness] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [rpe, setRpe] = useState('');
  const [stats, setStats] = useState('');
  const [noteAction, setNoteAction] = useState<AthleteNoteAction>('append');
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function clearNoteForm() {
    setNoteInput('');
    setActualDuration('');
    setFreshness('');
    setDifficulty('');
    setRpe('');
    setStats('');
  }

  function startNewNote() {
    clearNoteForm();
    setNoteAction('append');
    setSelectedNoteIndex(0);
  }

  function loadNoteForEditing(index: number) {
    const parsedNote = parseAthleteNoteForEditing(entry.athleteNotes[index] ?? '');

    setNoteAction('update');
    setSelectedNoteIndex(index);
    setNoteInput(parsedNote.note);
    setActualDuration(parsedNote.actualDuration);
    setFreshness(parsedNote.freshness);
    setDifficulty(parsedNote.difficulty);
    setRpe(parsedNote.rpe);
    setStats(parsedNote.stats);
  }

  useEffect(() => {
    setNoteInput('');
    setActualDuration('');
    setFreshness('');
    setDifficulty('');
    setRpe('');
    setStats('');
    setNoteAction('append');
    setSelectedNoteIndex(0);
    setSubmitMessage(null);
  }, [entry.category, entry.date, entry.time, entry.title]);

  const hasExistingNotes = entry.athleteNotes.length > 0;
  const hasSelectedExistingNote = noteAction !== 'update' || selectedNoteIndex < entry.athleteNotes.length;
  const canSubmit = Boolean(noteInput.trim() || actualDuration || freshness || difficulty || rpe || stats)
    && hasSelectedExistingNote;
  const canAddToFavorites = entry.category === 'Workout' && Boolean(onAddToFavorites);

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
        noteAction,
        noteIndex: noteAction === 'update' ? selectedNoteIndex : undefined,
      });
      startNewNote();
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

  async function handleAddToFavorites() {
    if (!onAddToFavorites) {
      return;
    }

    setSavingFavorite(true);
    setSubmitMessage(null);

    try {
      await onAddToFavorites(entry);
      setSubmitMessage({ type: 'success', text: 'Saved to favorites.' });
    } catch (error) {
      setSubmitMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save favorite',
      });
    } finally {
      setSavingFavorite(false);
    }
  }

  async function handleDeleteNote(index: number) {
    if (!onSubmitNote) return;

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      await onSubmitNote({
        note: '',
        actualDuration: '',
        freshness: '',
        difficulty: '',
        rpe: '',
        stats: '',
        noteAction: 'delete',
        noteIndex: index,
      });
      startNewNote();
      setSubmitMessage({ type: 'success', text: 'Note deleted successfully.' });
    } catch (error) {
      setSubmitMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete note',
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

        {entry.athleteNotes.filter(note => note.trim() !== '').length > 0 && (
          <div className="entry-detail-athlete-notes">
            <strong>My Notes:</strong>
            {entry.athleteNotes
              .filter(note => note.trim() !== '')
              .map((note, index) => (
                <div className="entry-detail-athlete-note" key={`${index}-${note.slice(0, 24)}`}>
                  <blockquote>{note}</blockquote>
                  <div className="note-action-buttons-row">
                    {onSubmitNote && (
                      <button
                        type="button"
                        className="entry-detail-edit-note"
                        onClick={() => loadNoteForEditing(index)}
                        disabled={submitting}
                      >
                        Edit note {index + 1}
                      </button>
                    )}
                    {onSubmitNote && (
                      <button
                        type="button"
                        className="entry-detail-delete-note btn-danger"
                        onClick={() => handleDeleteNote(index)}
                        disabled={submitting}
                        aria-label={`Delete note ${index + 1}`}
                      >
                        Delete 🗑️
                      </button>
                    )}
                  </div>
                </div>
            ))}
          </div>
        )}

        {onSubmitNote && (
          <div className="entry-detail-note-form">
            {hasExistingNotes && (
              <div className="entry-detail-note-mode" role="group" aria-label="Note action">
                <button
                  type="button"
                  className={noteAction === 'append' ? 'active' : ''}
                  aria-pressed={noteAction === 'append'}
                  onClick={startNewNote}
                  disabled={submitting}
                >
                  Add Note
                </button>
                <button
                  type="button"
                  className={noteAction === 'update' ? 'active' : ''}
                  aria-pressed={noteAction === 'update'}
                  onClick={() => loadNoteForEditing(Math.min(selectedNoteIndex, entry.athleteNotes.length - 1))}
                  disabled={submitting}
                >
                  Update Note
                </button>
              </div>
            )}

            {noteAction === 'update' && hasExistingNotes && (
              <div className="entry-detail-field entry-detail-existing-note-select">
                <label htmlFor="entry-existing-note">Existing Note</label>
                <select
                  id="entry-existing-note"
                  value={selectedNoteIndex}
                  onChange={event => loadNoteForEditing(Number(event.target.value))}
                  disabled={submitting}
                >
                  {entry.athleteNotes.map((note, index) => (
                    <option key={`${index}-${note.slice(0, 24)}`} value={index}>
                      {getNoteOptionLabel(note, index)}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
          {canAddToFavorites && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void handleAddToFavorites()}
              disabled={savingFavorite || submitting}
            >
              {savingFavorite ? 'Saving Favorite…' : 'Add to Favorites'}
            </button>
          )}
          {onSubmitNote && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleSubmit()}
              disabled={submitting || savingFavorite || !canSubmit}
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