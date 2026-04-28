import { parse as parseYaml } from 'yaml';
import type { PlanMeta, PlanEntry, PlanWeek, Category, WorkoutDetails } from '../types';

const VALID_CATEGORIES: Category[] = ['Workout', 'Life', 'Work', 'Note', 'Checkin'];

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function stringifyWorkoutStructureValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map(stringifyWorkoutStructureValue)
      .filter(Boolean)
      .join(', ');
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => {
        const renderedValue = stringifyWorkoutStructureValue(nestedValue);
        return renderedValue ? `${key}: ${renderedValue}` : key;
      })
      .filter(Boolean)
      .join(', ');
  }

  return '';
}

function normalizeWorkoutStructure(structure: unknown): string[] | undefined {
  const rawSteps = Array.isArray(structure)
    ? structure
    : structure == null
      ? []
      : [structure];

  const normalizedSteps = rawSteps
    .map(stringifyWorkoutStructureValue)
    .map(step => step.trim())
    .filter(Boolean);

  return normalizedSteps.length > 0 ? normalizedSteps : undefined;
}

export function normalizeWorkoutDetails(value: unknown): WorkoutDetails | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const rawWorkout = value as Record<string, unknown>;
  const workout: WorkoutDetails = {};

  if (typeof rawWorkout.type === 'string' && rawWorkout.type.trim()) {
    workout.type = rawWorkout.type.trim();
  }

  const durationMinutes = toFiniteNumber(rawWorkout.duration_minutes);
  if (durationMinutes != null) {
    workout.duration_minutes = durationMinutes;
  }

  if (typeof rawWorkout.intensity === 'string' && rawWorkout.intensity.trim()) {
    workout.intensity = rawWorkout.intensity.trim();
  }

  const tssPlanned = toFiniteNumber(rawWorkout.tss_planned);
  if (tssPlanned != null) {
    workout.tss_planned = tssPlanned;
  }

  const structure = normalizeWorkoutStructure(rawWorkout.structure);
  if (structure) {
    workout.structure = structure;
  }

  if (typeof rawWorkout.notes === 'string' && rawWorkout.notes.trim()) {
    workout.notes = rawWorkout.notes.trim();
  }

  return Object.keys(workout).length > 0 ? workout : undefined;
}

/** Parse YAML frontmatter from a markdown string */
function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  return { meta: parseYaml(match[1]) ?? {}, body: match[2] };
}

function extractWeekSummary(lines: string[]): string {
  const firstDayIndex = lines.findIndex(line => line.match(/^## (\d{4}-\d{2}-\d{2})\s+\((\w+)\)/));
  const summaryLines = [...(firstDayIndex >= 0 ? lines.slice(0, firstDayIndex) : lines)];

  while (summaryLines.length > 0 && summaryLines[0].trim() === '') {
    summaryLines.shift();
  }

  if (summaryLines[0]?.match(/^#\s+/)) {
    summaryLines.shift();
  }

  while (summaryLines.length > 0) {
    const firstLine = summaryLines[0].trim();
    if (firstLine === '' || firstLine === '---') {
      summaryLines.shift();
      continue;
    }
    break;
  }

  while (summaryLines.length > 0) {
    const lastLine = summaryLines[summaryLines.length - 1].trim();
    if (lastLine === '' || lastLine === '---') {
      summaryLines.pop();
      continue;
    }
    break;
  }

  return summaryLines.join('\n').trim();
}

/** Parse a full plan week file into structured data */
export function parsePlanFile(raw: string, filename: string): PlanWeek {
  const { meta, body } = parseFrontmatter(raw);

  const planMeta: PlanMeta = {
    week_start: String(meta.week_start ?? ''),
    season: String(meta.season ?? ''),
    training_block: String(meta.training_block ?? ''),
    week_number: Number(meta.week_number ?? 0),
  };

  const entries: PlanEntry[] = [];
  let currentDate = '';

  // Split into lines for parsing
  const lines = body.split('\n');
  const summary = extractWeekSummary(lines);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Day heading: ## 2026-04-13 (Monday)
    const dayMatch = line.match(/^## (\d{4}-\d{2}-\d{2})\s+\((\w+)\)/);
    if (dayMatch) {
      currentDate = dayMatch[1];
      i++;
      continue;
    }

    // Entry heading: ### HH:MM — Category: Title, ### All Day — Category: Title, or ### REST DAY
    const entryMatch = line.match(/^### (All Day|\d{2}:\d{2})\s*[—–-]\s*(\w+):\s*(.+)/);
    const restMatch = !entryMatch && line.match(/^### REST DAY/i);

    if (restMatch && currentDate) {
      entries.push({
        time: 'REST',
        category: 'Note' as Category,
        title: 'Rest Day',
        description: '',
        athleteNotes: [],
        date: currentDate,
      });
      i++;
      continue;
    }

    if (entryMatch && currentDate) {
      const [, rawTime, rawCategory, title] = entryMatch;
      const category = VALID_CATEGORIES.includes(rawCategory as Category)
        ? (rawCategory as Category)
        : 'Note';
      const time = rawTime === 'All Day' ? 'All Day' : rawTime;

      let description = '';
      let workoutYaml: WorkoutDetails | undefined;
      const athleteNotes: string[] = [];
      let eventId: string | undefined;
      let allDay = rawTime === 'All Day';

      i++;

      // Collect body content until next heading or end
      while (i < lines.length && !lines[i].match(/^##/)) {
        const l = lines[i];

        // Event ID comment (user-created events)
        const eventIdMatch = l.match(/^<!-- event_id:\s*(.+?)\s*-->$/);
        if (eventIdMatch) {
          eventId = eventIdMatch[1];
          i++;
          continue;
        }

        const allDayMatch = l.match(/^<!-- all_day:\s*true\s*-->$/i);
        if (allDayMatch) {
          allDay = true;
          i++;
          continue;
        }

        const metadataCommentMatch = l.match(/^<!--\s*(recurrence_id|all_day):/i);
        if (metadataCommentMatch) {
          i++;
          continue;
        }

        // YAML code block
        if (l.match(/^```yaml\s*$/)) {
          i++;
          let yamlBlock = '';
          while (i < lines.length && !lines[i].match(/^```\s*$/)) {
            yamlBlock += lines[i] + '\n';
            i++;
          }
          i++; // skip closing ```
          try {
            workoutYaml = normalizeWorkoutDetails(parseYaml(yamlBlock));
          } catch {
            // If YAML parsing fails, just skip it
          }
          continue;
        }

        // Athlete note callout block: > [!NOTE]
        if (l.match(/^>\s*\[!NOTE\]/i)) {
          i++;
          let noteContent = '';
          while (i < lines.length && lines[i].startsWith('>')) {
            noteContent += lines[i].replace(/^>\s?/, '') + '\n';
            i++;
          }
          athleteNotes.push(noteContent.trim());
          continue;
        }

        description += l + '\n';
        i++;
      }

      entries.push({
        time,
        category,
        title: title.trim(),
        description: description.trim(),
        workoutYaml,
        athleteNotes,
        date: currentDate,
        eventId,
        allDay,
      });
      continue;
    }

    i++;
  }

  return { meta: planMeta, filename, summary, entries };
}
