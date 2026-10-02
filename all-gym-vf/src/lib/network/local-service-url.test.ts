import assert from "node:assert/strict";
import test from "node:test";

import { parseLocalServiceBaseUrl } from "./local-service-url";

test("las rutas de servicios admiten solo loopback y el nombre Docker correspondiente", () => {
  assert.equal(parseLocalServiceBaseUrl("http://127.0.0.1:4001", "backend")?.host, "127.0.0.1:4001");
  assert.equal(parseLocalServiceBaseUrl("http://[::1]:8080", "sync")?.host, "[::1]:8080");
  assert.equal(parseLocalServiceBaseUrl("http://backend:4000", "backend")?.host, "backend:4000");
  assert.equal(parseLocalServiceBaseUrl("http://host.docker.internal:4000", "backend")?.host, "host.docker.internal:4000");
  assert.equal(parseLocalServiceBaseUrl("http://sync:8080", "sync")?.host, "sync:8080");
});

test("las rutas remotas o adulteradas se rechazan", () => {
  for (const value of [
    "https://backend:4000",
    "http://example.com:4000",
    "http://127.0.0.1.ejemplo.com:4000",
    "http://203.0.113.7:4000",
    "http://usuario:clave@backend:4000",
    "http://backend:4000/?destino=remoto",
    "http://backend:4000/#salto",
    "file:///tmp/api",
  ]) {
    assert.equal(parseLocalServiceBaseUrl(value, "backend"), null, value);
  }
  assert.equal(parseLocalServiceBaseUrl("http://sync:8080", "backend"), null);
  assert.equal(parseLocalServiceBaseUrl("http://backend:4000", "sync"), null);
});
