import type { FavoriteWorkoutPayload, PlanEntry } from '../../types';

export function buildFavoritePayloadFromEntry(entry: PlanEntry): FavoriteWorkoutPayload {
  return {
    title: entry.title,
    notes: entry.description.trim() || undefined,
    workout_details: entry.workoutYaml,
  };
}