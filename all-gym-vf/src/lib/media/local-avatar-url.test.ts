import assert from "node:assert/strict";
import test from "node:test";

import { localAvatarUrl } from "./local-avatar-url";

test("un avatar solo carga desde una ruta relativa al mismo sitio", () => {
  assert.equal(localAvatarUrl("/api/media/avatars/foto.png"), "/api/media/avatars/foto.png");
  for (const value of [
    "https://example.com/avatar.png",
    "http://203.0.113.7/avatar.png",
    "//example.com/avatar.png",
    "/\\example.com/avatar.png",
    "data:image/png;base64,AAAA",
  ]) {
    assert.equal(localAvatarUrl(value), undefined, value);
  }
});
