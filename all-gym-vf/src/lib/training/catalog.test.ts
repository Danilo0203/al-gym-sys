import assert from "node:assert/strict";
import test from "node:test";

import { normalizeExerciseCatalogItem } from "./catalog";

const localImage = `/api/media/exercises/${"a".repeat(64)}.webp`;

test("el catálogo solo expone imágenes del almacenamiento local", () => {
  assert.equal(normalizeExerciseCatalogItem({ id: 1, image_url: localImage }).image_url, localImage);

  for (const image_url of [
    "https://v2.exercisedb.io/image.gif",
    "https://example.com/storage/v1/object/public/exercises/old.gif",
    "//example.com/image.gif",
    "data:image/gif;base64,AAAA",
  ]) {
    const item = normalizeExerciseCatalogItem({ id: 2, image_url });
    assert.equal(item.image_url, null, image_url);
    assert.equal(item.video_url, null, image_url);
  }

  assert.equal(normalizeExerciseCatalogItem({ id: 3, animation_url: localImage }).image_url, localImage);
});
