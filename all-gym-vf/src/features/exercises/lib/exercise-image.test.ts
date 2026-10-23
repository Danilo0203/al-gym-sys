import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { fileToProcessedImageBuffer } from "./exercise-image";

test("al subir un GIF conserva todos sus fotogramas", async () => {
  const singleFrame = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
  const animatedGif = Buffer.concat([
    singleFrame.subarray(0, -1),
    singleFrame.subarray(19, -1),
    Buffer.from([0x3b]),
  ]);
  assert.equal((await sharp(animatedGif, { animated: true }).metadata()).pages, 2);

  const file = new File([animatedGif], "ejercicio.gif", { type: "image/gif" });
  const processed = await fileToProcessedImageBuffer(file);

  assert.deepEqual(processed, animatedGif);
  assert.equal((await sharp(processed, { animated: true }).metadata()).pages, 2);
});

test("MP4 conserva sus bytes y no pasa por el conversor de imágenes", async () => {
  const { fileToProcessedExerciseMediaBuffer } = await import("./exercise-image");
  const bytes = Buffer.from("MP4 passthrough; content validation is enforced by the backend");
  assert.deepEqual(await fileToProcessedExerciseMediaBuffer(new File([bytes], "demo.mp4", { type: "video/mp4" })), bytes);
  assert.deepEqual(await fileToProcessedExerciseMediaBuffer(new File([bytes], "demo.MP4")), bytes);
  await assert.rejects(fileToProcessedExerciseMediaBuffer(new File([bytes], "demo.mov", { type: "video/quicktime" })), /MP4/);
});
