import type { BlueprintDetailRecord, BlueprintRecord } from "../actions/blueprint-actions";
import type { RoutineBlockType } from "@/lib/training/types";

export interface BlueprintEditorData {
  blueprint: BlueprintRecord;
  details: BlueprintDetailRecord[];
}

export interface LocalExercise {
  tempId: string;
  exercise_id: number | null;
  exercise_name: string | null;
  exercise_image_url: string | null;
  block_type: RoutineBlockType;
  sets: string;
  reps: string;
  rest_seconds: string;
  duration_minutes: string;
  target_rir: string;
  notes: string | null;
}

export interface LocalDay {
  tempId: string;
  exercises: LocalExercise[];
}

export function blueprintDays(details: BlueprintDetailRecord[]): LocalDay[] {
  const grouped = new Map<number, LocalDay>();
  const sorted = [...details].sort((a, b) =>
    a.day_of_week - b.day_of_week ||
    (a.exercise_order ?? Infinity) - (b.exercise_order ?? Infinity) || a.id - b.id);
  for (const detail of sorted) {
    const day = grouped.get(detail.day_of_week) ?? {
      tempId: `day_${detail.day_of_week}`, exercises: [],
    };
    day.exercises.push({
      tempId: `exercise_${detail.id}`,
      exercise_id: detail.exercise_id,
      exercise_name: detail.exercise_name_snapshot,
      exercise_image_url: detail.exercise_image_url,
      block_type: detail.block_type,
      sets: detail.sets?.toString() ?? "",
      reps: detail.reps ?? "",
      rest_seconds: detail.rest_seconds?.toString() ?? "",
      duration_minutes: detail.duration_minutes?.toString() ?? "",
      target_rir: detail.target_rir?.toString() ?? "",
      notes: detail.notes,
    });
    grouped.set(detail.day_of_week, day);
  }
  return [...grouped.values()];
}

export function optionalMetric(value: string): number | null {
  return value.trim() ? Number(value.trim()) : null;
}

export function validateBlueprintDays(days: LocalDay[]): string | null {
  if (days.length < 1 || days.length > 7) return "La plantilla debe tener entre 1 y 7 días.";
  for (const [index, day] of days.entries()) {
    if (day.exercises.length < 1 || day.exercises.length > 60) {
      return `El día ${index + 1} debe tener entre 1 y 60 ejercicios.`;
    }
    for (const exercise of day.exercises) {
      if (!exercise.exercise_id) return "Todos los ejercicios deben tener un ejercicio seleccionado.";
      if (exercise.reps.trim().length > 80) return "Las repeticiones no pueden superar los 80 caracteres.";
      const metrics = [
        ["Series", exercise.sets, 1, 100, true],
        ["Descanso", exercise.rest_seconds, 0, 3600, true],
        ["Duración", exercise.duration_minutes, 0, 600, true],
        ["RIR", exercise.target_rir, 0, 10, false],
      ] as const;
      for (const [label, raw, min, max, integer] of metrics) {
        const value = optionalMetric(raw);
        if (value !== null && (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))) {
          return `${label}: ingresa un número ${integer ? "entero " : ""}entre ${min} y ${max} (día ${index + 1}).`;
        }
      }
    }
  }
  return null;
}
