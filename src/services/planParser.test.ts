import { describe, expect, it } from 'vitest';

import { normalizeWorkoutDetails, parsePlanFile } from './planParser';

const workoutPlan = [
  '---',
  'week_start: 2026-05-04',
  'season: base',
  'training_block: "Base Phase 2"',
  'week_number: 1.3',
  '---',
  '',
  '# Week of 2026-05-04',
  '',
  'Smooth build week. Keep the volume steady and avoid turning Tuesday into a race.',
  '',
  '---',
  '',
  '## 2026-05-04 (Monday)',
  '',
  '### 09:00 — Workout: Easy Endurance Ride — Back to It',
  '',
  'First day of your free week.',
  '',
  '```yaml',
  'type: ride',
  'duration_minutes: 60',
  'intensity: easy',
  'tss_planned: 42',
  'structure:',
  '  - warmup: "10min Z1"',
  '  - main: "40min Z2, steady rhythmic pedaling, 85-95rpm"',
  '  - cooldown: "10min Z1"',
  'notes: "Outdoor preferred."',
  '```',
].join('\n');

describe('planParser', () => {
  it('normalizes canonical structured workout yaml steps when parsing a plan file', () => {
    const parsed = parsePlanFile(workoutPlan, 'week-2026-05-04.md');

    expect(parsed.summary).toBe('Smooth build week. Keep the volume steady and avoid turning Tuesday into a race.');
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].workoutYaml).toEqual({
      type: 'ride',
      duration_minutes: 60,
      intensity: 'easy',
      tss_planned: 42,
      structure: [
        'warmup: 10min Z1',
        'main: 40min Z2, steady rhythmic pedaling, 85-95rpm',
        'cooldown: 10min Z1',
      ],
      notes: 'Outdoor preferred.',
    });
  });

  it('normalizes workout detail objects from yaml into render-safe values', () => {
    const workout = normalizeWorkoutDetails({
      type: 'ride',
      duration_minutes: '60',
      intensity: 'easy',
      tss_planned: '42',
      structure: [
        { warmup: '10min Z1' },
        { main: '40min Z2, steady rhythmic pedaling, 85-95rpm' },
        { cooldown: '10min Z1' },
      ],
      notes: 'Outdoor preferred.',
    });

    expect(workout).toEqual({
      type: 'ride',
      duration_minutes: 60,
      intensity: 'easy',
      tss_planned: 42,
      structure: [
        'warmup: 10min Z1',
        'main: 40min Z2, steady rhythmic pedaling, 85-95rpm',
        'cooldown: 10min Z1',
      ],
      notes: 'Outdoor preferred.',
    });
  });
});
