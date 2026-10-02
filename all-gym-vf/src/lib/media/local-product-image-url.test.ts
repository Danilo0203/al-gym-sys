import assert from "node:assert/strict";
import test from "node:test";

import { localProductImageUrl } from "./local-product-image-url";

test("solo se muestran imágenes de productos guardadas en el equipo", () => {
  const local = `/api/media/products/${"b".repeat(64)}.png`;
  assert.equal(localProductImageUrl(local), local);

  for (const value of [
    "https://example.com/storage/v1/object/public/products/foto.png",
    "//example.com/foto.png",
    "data:image/png;base64,AAAA",
    "/api/media/products/otro.png",
    "/api/media/exercises/" + "b".repeat(64) + ".png",
  ]) {
    assert.equal(localProductImageUrl(value), null, value);
  }
});
