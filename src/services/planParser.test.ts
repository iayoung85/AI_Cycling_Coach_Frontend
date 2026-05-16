import { describe, expect, it } from 'vitest';

import { normalizeWorkoutDetails, parsePlanFile } from './planParser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlan(yamlLines: string[]): string {
  return [
    '---',
    'week_start: 2026-05-04',
    'season: base',
    'training_block: "Base"',
    'week_number: 1.1',
    '---',
    '',
    '# Week of 2026-05-04',
    '',
    '---',
    '',
    '## 2026-05-04 (Monday)',
    '',
    '### 09:00 — Workout: Test Workout',
    '<!-- event_id: test-id-001 -->',
    '',
    '```yaml',
    ...yamlLines,
    '```',
  ].join('\n');
}

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

// ---------------------------------------------------------------------------
// Existing tests
// ---------------------------------------------------------------------------

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

  it('parses early-morning workouts and later entries around malformed coach subheadings', () => {
    const parsed = parsePlanFile(
      [
        '---',
        'week_start: 2026-05-18',
        'season: base',
        'training_block: "Base Phase 2"',
        'week_number: 1.5',
        '---',
        '',
        '# Week of 2026-05-18',
        '',
        '## 2026-05-24 (Sunday)',
        '',
        '### 01:00 — Workout: Night Shift Easy Spin',
        '',
        'Overnight trainer ride.',
        '',
        '```yaml',
        'type: ride',
        'duration_minutes: 45',
        '```',
        '',
        '### Sleep after shift (05:30 onwards)',
        '',
        'Malformed coach note that should not become an event or block later entries.',
        '',
        '### 17:30 — Work: Night Shift',
        '<!-- event_id: recur-work-night-shift-2026-05-24 -->',
        '<!-- recurrence_id: work-night-shift -->',
        '',
        'Rotation week 1.',
      ].join('\n'),
      'week-2026-05-18.md',
    );

    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries.map(entry => [entry.time, entry.category, entry.title])).toEqual([
      ['01:00', 'Workout', 'Night Shift Easy Spin'],
      ['17:30', 'Work', 'Night Shift'],
    ]);
    expect(parsed.entries[0].workoutYaml).toEqual({
      type: 'ride',
      duration_minutes: 45,
    });
  });
});

// ---------------------------------------------------------------------------
// YAML format robustness — block scalar (pyyaml output) and edge-case strings
// ---------------------------------------------------------------------------

describe('planParser — yaml block formats', () => {
  it('does not absorb day separators into the last event notes and parses later same-day entries separately', () => {
    const parsed = parsePlanFile(
      [
        '---',
        'week_start: 2026-05-04',
        'season: base',
        'training_block: "Base"',
        'week_number: 1.1',
        '---',
        '',
        '# Week of 2026-05-04',
        '',
        '---',
        '',
        '## 2026-05-04 (Monday)',
        '',
        '### 07:00 — Workout: First Session',
        '',
        'Stay smooth.',
        '',
        '### 17:00 — Workout: Second Session',
        '',
        'Mobility only.',
        '',
        '---',
        '',
        '## 2026-05-05 (Tuesday)',
        '',
        '### REST DAY',
      ].join('\n'),
      'week-2026-05-04.md',
    );

    expect(parsed.entries).toHaveLength(3);
    expect(parsed.entries[0].title).toBe('First Session');
    expect(parsed.entries[0].description).toBe('Stay smooth.');
    expect(parsed.entries[1].title).toBe('Second Session');
    expect(parsed.entries[1].description).toBe('Mobility only.');
  });

  it('ignores favorite provenance comments in event bodies', () => {
    const parsed = parsePlanFile(
      [
        '---',
        'week_start: 2026-05-04',
        'season: base',
        'training_block: "Base"',
        'week_number: 1.1',
        '---',
        '',
        '# Week of 2026-05-04',
        '',
        '---',
        '',
        '## 2026-05-04 (Monday)',
        '',
        '### 09:00 — Workout: Favorite-Derived Session',
        '<!-- event_id: test-id-001 -->',
        '<!-- favorite_id: ftp-builder -->',
        '',
        'Copied forward from a favorite session.',
        '',
        '```yaml',
        'type: ride',
        'duration_minutes: 60',
        '```',
      ].join('\n'),
      'week-2026-05-04.md',
    );

    expect(parsed.entries[0].description).toBe('Copied forward from a favorite session.');
    expect(parsed.entries[0].eventId).toBe('test-id-001');
  });

  it('parses block scalar notes written by the backend (|-)', () => {
    // pyyaml uses |- style for multi-line strings without a trailing newline
    const parsed = parsePlanFile(
      makePlan([
        'type: Strength and Mobility',
        'duration_minutes: 40',
        'intensity: moderate',
        'notes: |-',
        "  - 15' outdoor walk",
        '  - MFR PVC pipe roll out muscles full body',
        "  - Hip stretches, 90/90's",
        '  2 rotations:',
        '  - 2x10 pushups',
        '  - 2x20 lunges',
      ]),
      'week-2026-05-04.md',
    );
    const w = parsed.entries[0].workoutYaml!;
    expect(w.type).toBe('Strength and Mobility');
    expect(w.intensity).toBe('moderate');
    expect(w.notes).toContain("15' outdoor walk");
    expect(w.notes).toContain("90/90's");
    expect(w.notes).toContain('2x10 pushups');
  });

  it('parses block scalar notes with | style (trailing newline preserved)', () => {
    const parsed = parsePlanFile(
      makePlan([
        'type: ride',
        'notes: |',
        '  First line',
        '  Second line',
        '  Third: line with colon',
      ]),
      'week-2026-05-04.md',
    );
    const w = parsed.entries[0].workoutYaml!;
    expect(w.notes).toContain('First line');
    expect(w.notes).toContain('Third: line with colon');
  });

  it('parses notes containing colons without treating them as yaml keys', () => {
    const parsed = parsePlanFile(
      makePlan([
        'type: ride',
        'notes: |-',
        '  Target HR: 145bpm',
        '  Gear ratio: 34:28',
      ]),
      'week-2026-05-04.md',
    );
    expect(parsed.entries[0].workoutYaml?.notes).toContain('Target HR: 145bpm');
    expect(parsed.entries[0].workoutYaml?.notes).toContain('Gear ratio: 34:28');
  });

  it("parses notes containing apostrophes and single quotes", () => {
    const parsed = parsePlanFile(
      makePlan([
        'type: strength',
        "notes: \"Coach's tip: don't skip the warm-up\"",
      ]),
      'week-2026-05-04.md',
    );
    expect(parsed.entries[0].workoutYaml?.notes).toContain("Coach's tip");
  });

  it('parses notes containing double quotes inside single-quoted yaml scalar', () => {
    // Some yaml serializers may choose single-quoted style for strings with "
    const parsed = parsePlanFile(
      makePlan([
        "type: ride",
        "notes: 'Coach said \"go easy\" today'",
      ]),
      'week-2026-05-04.md',
    );
    expect(parsed.entries[0].workoutYaml?.notes).toContain('Coach said "go easy" today');
  });

  it('parses notes with unicode and emoji', () => {
    const parsed = parsePlanFile(
      makePlan([
        'type: ride',
        'notes: "Great ride! \uD83D\uDEB4 Felt strong \uD83D\uDCAA"',
      ]),
      'week-2026-05-04.md',
    );
    expect(parsed.entries[0].workoutYaml?.notes).toContain('Great ride!');
    expect(parsed.entries[0].workoutYaml?.notes).toContain('🚴');
  });

  it('parses type field containing spaces (Strength and Mobility)', () => {
    const parsed = parsePlanFile(
      makePlan(['type: Strength and Mobility', 'duration_minutes: 40']),
      'week-2026-05-04.md',
    );
    expect(parsed.entries[0].workoutYaml?.type).toBe('Strength and Mobility');
  });

  it('parses intensity field containing spaces (very hard)', () => {
    const parsed = parsePlanFile(
      makePlan(['type: ride', 'intensity: very hard']),
      'week-2026-05-04.md',
    );
    expect(parsed.entries[0].workoutYaml?.intensity).toBe('very hard');
  });

  it('returns undefined workoutYaml when yaml block is invalid and does not throw', () => {
    // If user somehow enters truly broken yaml, the parser should degrade gracefully
    const plan = makePlan([
      'type: ride',
      'notes: "unclosed double quote string',  // intentionally broken
    ]);
    // Should not throw
    const parsed = parsePlanFile(plan, 'week-2026-05-04.md');
    // workoutYaml will be undefined due to parse failure — entry still exists
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].workoutYaml).toBeUndefined();
  });

  it('returns undefined workoutYaml when there is no yaml block', () => {
    const plan = makePlan([]);  // no yaml content between fences → empty block
    const parsed = parsePlanFile(plan, 'week-2026-05-04.md');
    // Empty yaml → normalizeWorkoutDetails returns undefined
    expect(parsed.entries[0].workoutYaml).toBeUndefined();
  });

  it('handles missing optional fields gracefully', () => {
    const parsed = parsePlanFile(
      makePlan(['type: ride']),
      'week-2026-05-04.md',
    );
    const w = parsed.entries[0].workoutYaml!;
    expect(w.type).toBe('ride');
    expect(w.duration_minutes).toBeUndefined();
    expect(w.intensity).toBeUndefined();
    expect(w.tss_planned).toBeUndefined();
    expect(w.structure).toBeUndefined();
    expect(w.notes).toBeUndefined();
  });
});

