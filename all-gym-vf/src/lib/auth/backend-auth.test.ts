import assert from "node:assert/strict";
import test from "node:test";

import { AuthBackendTransportError, buildAuthBackendUrl, fetchAuthBackend } from "./backend-auth";

test("una URL remota configurada no produce ninguna petición", async () => {
  const previousUrl = process.env.ALGYM_BACKEND_URL;
  const previousFetch = globalThis.fetch;
  let calls = 0;
  process.env.ALGYM_BACKEND_URL = "https://example.com";
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("No debe llamarse a fetch");
  };

  try {
    await assert.rejects(fetchAuthBackend("/health"), (error: unknown) =>
      error instanceof AuthBackendTransportError && error.kind === "unavailable");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.ALGYM_BACKEND_URL;
    else process.env.ALGYM_BACKEND_URL = previousUrl;
  }
});

test("una URL local conserva la ruta del backend", () => {
  const previousUrl = process.env.ALGYM_BACKEND_URL;
  process.env.ALGYM_BACKEND_URL = "http://127.0.0.1:4001";
  try {
    assert.equal(buildAuthBackendUrl("/customers").href, "http://127.0.0.1:4001/customers");
  } finally {
    if (previousUrl === undefined) delete process.env.ALGYM_BACKEND_URL;
    else process.env.ALGYM_BACKEND_URL = previousUrl;
  }
});
