import type { RoutineDetailRecord } from "@/lib/training/types";
import { getDayProgress } from "@/lib/training/routine-progress";

export function getRoutineDays(details: RoutineDetailRecord[]) {
  const grouped = new Map<number, RoutineDetailRecord[]>();
  for (const detail of details) {
    const exercises = grouped.get(detail.day_of_week) ?? [];
    exercises.push(detail);
    grouped.set(detail.day_of_week, exercises);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([day, exercises]) => ({
      day,
      exercises: exercises.sort((left, right) =>
        (left.exercise_order ?? Number.MAX_SAFE_INTEGER) - (right.exercise_order ?? Number.MAX_SAFE_INTEGER) || left.id - right.id),
    }));
}

export function getInitialRoutineDay(days: ReturnType<typeof getRoutineDays>, completedIds: ReadonlySet<number>) {
  return (days.find(({ exercises }) => !getDayProgress(exercises, completedIds).isComplete) ?? days[0])?.day ?? null;
}

export function getExercisePrescription(detail: RoutineDetailRecord) {
  return [
    detail.sets != null && detail.reps ? `${detail.sets} × ${detail.reps} reps` :
      detail.sets != null ? `${detail.sets} series` : detail.reps ? `${detail.reps} reps` : null,
    detail.duration_minutes != null ? `${detail.duration_minutes} min` : null,
    detail.rest_seconds != null ? `${detail.rest_seconds} s descanso` : null,
  ].filter(Boolean).join(" · ") || "Consulta las indicaciones de tu entrenador";
}

export const ROUTINE_BLOCK_LABELS: Record<RoutineDetailRecord["block_type"], string> = {
  warmup: "Calentamiento",
  strength: "Fuerza",
  accessory: "Accesorio",
  cardio: "Cardio",
  mobility: "Movilidad",
};
