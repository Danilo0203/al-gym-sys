import assert from "node:assert/strict";
import test from "node:test";
import { getExerciseMediaUploadError, hydrateExerciseCatalogMedia, isExerciseMediaStoredLocally, isExerciseVideoUrl } from "./exercise-media";
import { normalizeExerciseCatalogItem } from "./catalog";

const base = `/api/media/exercises/${"a".repeat(64)}`;

test("catálogo conserva GIF y MP4 locales y bloquea URLs remotas o inválidas", async () => {
  const items = ["gif", "mp4"].map((ext) => normalizeExerciseCatalogItem({ id: 1, image_url: `${base}.${ext}` }));
  const hydrated = await hydrateExerciseCatalogMedia(items);
  assert.deepEqual(hydrated.map((item) => item.image_url), [`${base}.gif`, `${base}.mp4`]);
  assert.equal(isExerciseVideoUrl(`${base}.mp4`), true);
  assert.equal(isExerciseVideoUrl(`${base}.gif`), false);
  for (const url of ["https://example.com/demo.mp4", "/api/media/exercises/../video.mp4", "/api/media/products/video.mp4", `${base}.mov`]) {
    assert.equal(isExerciseMediaStoredLocally(url), false);
  }
});

test("límites de carga: imágenes de 5 MB, MP4 de 20 MB; rechaza vacíos y otros formatos", () => {
  for (const [type, limit] of [["image/gif", 5], ["image/png", 5], ["video/mp4", 20]] as const) {
    assert.equal(getExerciseMediaUploadError({ name: "demo", type, size: limit * 1024 * 1024 }), null);
    assert.match(getExerciseMediaUploadError({ name: "demo", type, size: limit * 1024 * 1024 + 1 })!, new RegExp(`${limit} MB`));
    assert.ok(getExerciseMediaUploadError({ name: "demo", type, size: 0 }));
  }
  assert.ok(getExerciseMediaUploadError({ name: "demo.mov", type: "video/quicktime", size: 10 }));
});
