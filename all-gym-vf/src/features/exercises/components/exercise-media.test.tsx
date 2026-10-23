import assert from "node:assert/strict";
import test from "node:test";
import { ExerciseMedia } from "./exercise-media";

const base = `/api/media/exercises/${"a".repeat(64)}`;
test("GIF sigue siendo imagen; MP4 usa video en bucle, inline, silenciado y con controles", () => {
  const gif = ExerciseMedia({ src: `${base}.gif`, alt: "GIF" });
  assert.equal(gif.type, "img");
  assert.equal(gif.props.src, `${base}.gif`);
  const video = ExerciseMedia({ src: `${base}.mp4`, alt: "MP4" });
  assert.equal(video.type, "video");
  for (const prop of ["autoPlay", "muted", "loop", "playsInline", "controls"]) assert.equal(video.props[prop], true);
  const preview = ExerciseMedia({ src: "blob:preview", alt: "MP4 seleccionado", isVideo: true, controls: false });
  assert.equal(preview.type, "video");
  assert.equal(preview.props.controls, false);
});
