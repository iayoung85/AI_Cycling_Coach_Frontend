// Plan file frontmatter
export interface PlanMeta {
  week_start: string;
  season: string;
  training_block: string;
  week_number: number;
}

// A single entry under a day (workout, life event, checkin, etc.)
export interface PlanEntry {
  time: string;            // "HH:MM" or "REST DAY"
  category: Category;
  title: string;
  description: string;     // markdown content below the heading
  workoutYaml?: WorkoutDetails;
  athleteNotes: string[];  // content from > [!NOTE] blocks
  date: string;            // YYYY-MM-DD (from parent day heading)
  eventId?: string;        // present only on user-created events
}

export type UserEventCategory = 'Life' | 'Work' | 'Workout';

// Payload for creating or updating a user event
export interface UserEventPayload {
  time: string;
  category: UserEventCategory;
  title: string;
  notes?: string;
  workout_details?: Partial<WorkoutDetails>;
}

// Response from create/update event endpoints
export interface UserEventResponse {
  event_id: string;
  time: string;
  category: string;
  title: string;
  notes: string | null;
  date: string;
  workout_details: Partial<WorkoutDetails> | null;
}

export type Category = 'Workout' | 'Life' | 'Work' | 'Note' | 'Checkin';

// Structured workout fields from yaml code block
export interface WorkoutDetails {
  type: string;
  duration_minutes: number;
  intensity: string;
  tss_planned?: number;
  structure?: { [key: string]: string }[];
  notes?: string;
}

// A full parsed week
export interface PlanWeek {
  meta: PlanMeta;
  filename: string;
  entries: PlanEntry[];
}
