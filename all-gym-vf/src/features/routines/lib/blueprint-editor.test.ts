import assert from "node:assert/strict";
import test from "node:test";
import type { BlueprintDetailRecord } from "../actions/blueprint-actions";
import { blueprintDays, optionalMetric, validateBlueprintDays } from "./blueprint-editor";

const detail: BlueprintDetailRecord = {
  id: 10, blueprint_id: "test", day_of_week: 1, exercise_id: 7, exercise_order: 1,
  block_type: "strength", sets: 4, reps: "8-12", rest_seconds: 0,
  duration_minutes: null, target_rir: 0, notes: "Técnica controlada",
  exercise_name_snapshot: "Sentadilla", exercise_image_url: null, exercise_video_url: null,
};

test("recupera días y orden de ejercicios con ceros, notas y valores opcionales", () => {
  const input = [{ ...detail, id: 12, day_of_week: 2 }, { ...detail, id: 11, exercise_order: 2 }, detail];
  const days = blueprintDays(input);
  assert.deepEqual(days.map((day) => day.exercises.map((exercise) => exercise.tempId)),
    [["exercise_10", "exercise_11"], ["exercise_12"]]);
  assert.equal(input[0].id, 12);
  assert.equal(days[0].exercises[0].sets, "4");
  assert.equal(days[0].exercises[0].reps, "8-12");
  assert.equal(days[0].exercises[0].rest_seconds, "0");
  assert.equal(days[0].exercises[0].target_rir, "0");
  assert.equal(days[0].exercises[0].duration_minutes, "");
  assert.equal(days[0].exercises[0].notes, detail.notes);
  assert.equal(validateBlueprintDays(days), null);
});

test("guardar conserva el cero y rechaza métricas inválidas y ejercicios eliminados", () => {
  assert.equal(optionalMetric("0"), 0);
  assert.equal(optionalMetric(" "), null);
  assert.equal(optionalMetric("1.5"), 1.5);
  for (const patch of [{ sets: "abc" }, { sets: "0" }, { sets: "1.5" },
    { rest_seconds: "-1" }, { rest_seconds: "3601" }, { target_rir: "11" }, { exercise_id: null }]) {
    const days = blueprintDays([detail]);
    Object.assign(days[0].exercises[0], patch);
    assert.ok(validateBlueprintDays(days));
  }
  assert.ok(validateBlueprintDays([]));
  assert.ok(validateBlueprintDays([{ tempId: "empty", exercises: [] }]));
  assert.ok(validateBlueprintDays(Array.from({ length: 8 }, () => blueprintDays([detail])[0])));
});
