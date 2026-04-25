import { parse as parseYaml } from 'yaml';
import type { PlanMeta, PlanEntry, PlanWeek, Category, WorkoutDetails } from '../types';

const VALID_CATEGORIES: Category[] = ['Workout', 'Life', 'Work', 'Note', 'Checkin'];

/** Parse YAML frontmatter from a markdown string */
function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  return { meta: parseYaml(match[1]) ?? {}, body: match[2] };
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

    // Entry heading: ### HH:MM — Category: Title  OR  ### REST DAY
    const entryMatch = line.match(/^### (\d{2}:\d{2})\s*[—–-]\s*(\w+):\s*(.+)/);
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
      const [, time, rawCategory, title] = entryMatch;
      const category = VALID_CATEGORIES.includes(rawCategory as Category)
        ? (rawCategory as Category)
        : 'Note';

      let description = '';
      let workoutYaml: WorkoutDetails | undefined;
      const athleteNotes: string[] = [];
      let eventId: string | undefined;

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
            workoutYaml = parseYaml(yamlBlock) as WorkoutDetails;
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
      });
      continue;
    }

    i++;
  }

  return { meta: planMeta, filename, entries };
}
