import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { proxy } from "./proxy";

function apiRequest(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/auth/logout", {
    method,
    headers: { host: "localhost:3000", ...headers },
  });
}

test("rejects API mutations from another local port or a foreign site", async () => {
  const cases: Record<string, string>[] = [
    { origin: "http://localhost:9999", "sec-fetch-site": "same-site" },
    { origin: "https://example.com", "sec-fetch-site": "cross-site" },
    { origin: "null" },
  ];
  for (const headers of cases) {
    const response = await proxy(apiRequest("POST", headers));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "INVALID_ORIGIN");
  }
});

test("allows same-origin and internal API mutations", async () => {
  const cases: Record<string, string>[] = [
    { origin: "http://localhost:3000", "sec-fetch-site": "same-origin" },
    {},
  ];
  for (const headers of cases) {
    const response = await proxy(apiRequest("POST", headers));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  }
});

test("leaves API reads available to their existing authorization checks", async () => {
  const response = await proxy(apiRequest("GET", {
    origin: "https://example.com",
    "sec-fetch-site": "cross-site",
  }));
  assert.equal(response.status, 200);
});
