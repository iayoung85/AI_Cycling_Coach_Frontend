import type { PlanEntry, PlanWeek } from '../../types';

export interface AthleteNoteMetadata {
  actual_duration?: number;
  freshness?: number;
  difficulty?: number;
  rpe?: number;
  stats?: string;
}

export interface EntryDetailModalNotePayload {
  note: string;
  actualDuration: string;
  freshness: string;
  difficulty: string;
  rpe: string;
  stats: string;
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function buildAthleteNoteRequest(
  entry: PlanEntry,
  payload: EntryDetailModalNotePayload,
): { noteToSend?: string; metadata?: AthleteNoteMetadata } {
  const trimmedNote = payload.note.trim();
  const hasExistingNotes = entry.athleteNotes.length > 0;

  const metadata: AthleteNoteMetadata = {};
  const actualDuration = parseOptionalNumber(payload.actualDuration);
  const freshness = parseOptionalNumber(payload.freshness);
  const difficulty = parseOptionalNumber(payload.difficulty);
  const rpe = parseOptionalNumber(payload.rpe);

  if (actualDuration !== undefined) {
    metadata.actual_duration = actualDuration;
  }
  if (freshness !== undefined) {
    metadata.freshness = freshness;
  }
  if (difficulty !== undefined) {
    metadata.difficulty = difficulty;
  }
  if (rpe !== undefined) {
    metadata.rpe = rpe;
  }
  if (payload.stats.trim()) {
    metadata.stats = payload.stats.trim();
  }

  return {
    noteToSend: trimmedNote || (!hasExistingNotes
      ? (entry.category === 'Workout' ? 'Workout stats' : 'Rest day stats')
      : undefined),
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

export function applyAthleteNoteToWeeks(
  weeks: PlanWeek[],
  targetEntry: PlanEntry,
  noteContent: string,
): { weeks: PlanWeek[]; updatedEntry: PlanEntry | null } {
  const matchesTarget = (entry: PlanEntry) => (
    entry.date === targetEntry.date &&
    entry.time === targetEntry.time &&
    entry.category === targetEntry.category &&
    entry.title === targetEntry.title &&
    entry.eventId === targetEntry.eventId
  );

  const updatedWeeks = weeks.map(week => ({
    ...week,
    entries: week.entries.map(entry => (
      matchesTarget(entry)
        ? { ...entry, athleteNotes: [noteContent] }
        : entry
    )),
  }));

  const updatedEntry = updatedWeeks
    .flatMap(week => week.entries)
    .find(matchesTarget) ?? null;

  return { weeks: updatedWeeks, updatedEntry };
}