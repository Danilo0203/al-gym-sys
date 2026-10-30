import assert from "node:assert/strict";
import test from "node:test";
import type { RoutineDetailRecord } from "@/lib/training/types";
import { getExercisePrescription, getInitialRoutineDay, getRoutineDays } from "./routine-view";

function exercise(id: number, day: number, order: number | null, values: Partial<RoutineDetailRecord> = {}): RoutineDetailRecord {
  return { id, day_of_week: day, exercise_order: order, routine_id: "routine", exercise_id: id,
    block_type: "strength", sets: 3, reps: "10–12", rest_seconds: 90, duration_minutes: null,
    target_rir: null, notes: null, exercise_name_snapshot: "Ejercicio", exercise_image_url: null,
    exercise_video_url: null, ...values };
}

test("mantiene días no consecutivos y ordena ejercicios sin modificar los datos recibidos", () => {
  const input = [exercise(5, 4, null), exercise(3, 1, 2), exercise(4, 4, 1), exercise(2, 1, 1)];
  const original = structuredClone(input);
  const days = getRoutineDays(input);
  assert.deepEqual(days.map(({ day, exercises }) => [day, exercises.map(({ id }) => id)]), [[1, [2, 3]], [4, [4, 5]]]);
  assert.deepEqual(input, original);
});

test("abre el primer día pendiente, permite repasar un plan completo y admite un plan vacío", () => {
  const days = getRoutineDays([exercise(1, 2, 1), exercise(2, 5, 1)]);
  assert.equal(getInitialRoutineDay(days, new Set([1])), 5);
  assert.equal(getInitialRoutineDay(days, new Set([1, 2])), 2);
  assert.equal(getInitialRoutineDay([], new Set()), null);
});

test("la lista conserva duración y descanso cero, sin inventar series para cardio", () => {
  assert.equal(getExercisePrescription(exercise(1, 1, 1)), "3 × 10–12 reps · 90 s descanso");
  assert.equal(getExercisePrescription(exercise(2, 1, 2, { sets: null, reps: null, duration_minutes: 15, rest_seconds: 0 })), "15 min · 0 s descanso");
  assert.equal(getExercisePrescription(exercise(3, 1, 3, { sets: null, reps: null, rest_seconds: null })), "Consulta las indicaciones de tu entrenador");
});
