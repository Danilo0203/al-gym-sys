import assert from "node:assert/strict";
import test from "node:test";

import { routineDetailSchema } from "./local-customer-routine";

const localImage = `/api/media/exercises/${"a".repeat(64)}.webp`;
const detail = {
  id: 1,
  routine_id: "11111111-1111-4111-8111-111111111111",
  day_of_week: 1,
  exercise_id: 12,
  exercise_order: 1,
  block_type: "strength",
  sets: 3,
  reps: "10",
  rest_seconds: 60,
  duration_minutes: null,
  target_rir: 2,
  notes: null,
  exercise_name_snapshot: "Ejercicio de prueba",
};

test("los detalles de rutina no entregan imágenes ni videos remotos al navegador", () => {
  const remote = routineDetailSchema.parse({
    ...detail,
    exercise_image_url: "https://example.com/exercise.gif",
    exercise_video_url: "https://example.com/exercise.mp4",
  });
  assert.equal(remote.exercise_image_url, null);
  assert.equal(remote.exercise_video_url, null);

  const local = routineDetailSchema.parse({
    ...detail,
    exercise_image_url: localImage,
    exercise_video_url: null,
  });
  assert.equal(local.exercise_image_url, localImage);
  assert.equal(local.exercise_video_url, null);
});
