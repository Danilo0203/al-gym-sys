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
