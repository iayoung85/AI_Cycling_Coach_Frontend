import type {
  AthleteNoteAction,
  AthleteNoteMetadata,
  AthleteNoteOptions,
  PlanEntry,
  PlanWeek,
} from '../../types';

export interface EntryDetailModalNotePayload {
  note: string;
  actualDuration: string;
  freshness: string;
  difficulty: string;
  rpe: string;
  stats: string;
  noteAction: AthleteNoteAction;
  noteIndex?: number;
}

export interface EditableAthleteNoteFields {
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

export function parseAthleteNoteForEditing(noteContent: string): EditableAthleteNoteFields {
  const fields: EditableAthleteNoteFields = {
    note: '',
    actualDuration: '',
    freshness: '',
    difficulty: '',
    rpe: '',
    stats: '',
  };
  const noteLines: string[] = [];

  for (const rawLine of noteContent.split('\n')) {
    const line = rawLine.trim();

    if (!line) {
      noteLines.push(rawLine);
      continue;
    }

    if (/^\*\*Athlete note\*\*/i.test(line)) {
      continue;
    }

    const durationMatch = line.match(/^- Duration:\s*(\d+)/i);
    if (durationMatch) {
      fields.actualDuration = durationMatch[1];
      continue;
    }

    const freshnessMatch = line.match(/^- Freshness:\s*(\d+)/i);
    if (freshnessMatch) {
      fields.freshness = freshnessMatch[1];
      continue;
    }

    const difficultyMatch = line.match(/^- Difficulty:\s*(\d+)/i);
    if (difficultyMatch) {
      fields.difficulty = difficultyMatch[1];
      continue;
    }

    const rpeMatch = line.match(/^- RPE:\s*(\d+)/i);
    if (rpeMatch) {
      fields.rpe = rpeMatch[1];
      continue;
    }

    const statsMatch = line.match(/^- Stats:\s*(.*)$/i);
    if (statsMatch) {
      fields.stats = statsMatch[1].trim();
      continue;
    }

    noteLines.push(rawLine);
  }

  fields.note = noteLines.join('\n').trim();
  return fields;
}

export function buildAthleteNoteRequest(
  entry: PlanEntry,
  payload: EntryDetailModalNotePayload,
): { noteToSend?: string; metadata?: AthleteNoteMetadata; noteOptions: AthleteNoteOptions } {
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

  const hasMetadata = Object.keys(metadata).length > 0;
  const shouldUseFallbackNote = !trimmedNote && hasMetadata && (
    payload.noteAction === 'append' || !hasExistingNotes
  );

  const noteOptions: AthleteNoteOptions = { action: payload.noteAction };
  if (payload.noteAction === 'update' && payload.noteIndex !== undefined) {
    noteOptions.noteIndex = payload.noteIndex;
  }

  return {
    noteToSend: trimmedNote || (shouldUseFallbackNote
      ? (entry.category === 'Workout' ? 'Workout stats' : 'Rest day stats')
      : undefined),
    metadata: hasMetadata ? metadata : undefined,
    noteOptions,
  };
}

function mergeAthleteNotes(
  existingNotes: string[],
  noteContent: string,
  options: AthleteNoteOptions,
): string[] {
  const action = options.action ?? 'upsert';
  const targetIndex = options.noteIndex ?? 0;

  if (action === 'append') {
    return [...existingNotes, noteContent];
  }

  if (action === 'update') {
    if (targetIndex >= 0 && targetIndex < existingNotes.length) {
      return existingNotes.map((note, index) => (index === targetIndex ? noteContent : note));
    }

    return [...existingNotes, noteContent];
  }

  if (existingNotes.length === 0) {
    return [noteContent];
  }

  if (targetIndex >= 0 && targetIndex < existingNotes.length) {
    return existingNotes.map((note, index) => (index === targetIndex ? noteContent : note));
  }

  return [noteContent, ...existingNotes.slice(1)];
}

export function applyAthleteNoteToWeeks(
  weeks: PlanWeek[],
  targetEntry: PlanEntry,
  noteContent: string,
  options: AthleteNoteOptions = {},
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
        ? { ...entry, athleteNotes: mergeAthleteNotes(entry.athleteNotes, noteContent, options) }
        : entry
    )),
  }));

  const updatedEntry = updatedWeeks
    .flatMap(week => week.entries)
    .find(matchesTarget) ?? null;

  return { weeks: updatedWeeks, updatedEntry };
}