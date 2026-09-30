import assert from "node:assert/strict";
import test from "node:test";

import { reconcileLocalCustomerOnClock } from "./local-device-sync";

test("reconcilia un cliente solo con el servicio local y token del servidor", async () => {
  const previous = {
    url: process.env.GYM_SYNC_SERVER_URL,
    token: process.env.GYM_SYNC_API_TOKEN,
    device: process.env.DEFAULT_ZK_DEVICE_SN,
    fetch: globalThis.fetch,
  };

  try {
    process.env.GYM_SYNC_SERVER_URL = "http://127.0.0.1:8080";
    process.env.GYM_SYNC_API_TOKEN = "test-local-token";
    process.env.DEFAULT_ZK_DEVICE_SN = "LOCALCLOCK";

    let calls = 0;
    globalThis.fetch = async (input, init) => {
      calls += 1;
      assert.equal(String(input), "http://127.0.0.1:8080/api/device-users/reconcile");
      assert.equal(init?.method, "POST");
      assert.equal((init?.headers as Record<string, string>).authorization, "Bearer test-local-token");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        customer_id: "7cb2a37b-f258-49ce-94e3-df41fc66f662",
        device_id: "LOCALCLOCK",
      });
      return Response.json({ success: true, queued_commands: 2 });
    };

    const result = await reconcileLocalCustomerOnClock("7cb2a37b-f258-49ce-94e3-df41fc66f662");
    assert.deepEqual(result, { attempted: true, synced: true, queued: true, method: "queue" });
    assert.equal(calls, 1);

    process.env.GYM_SYNC_SERVER_URL = "http://2.25.212.207:8080";
    assert.deepEqual(await reconcileLocalCustomerOnClock("7cb2a37b-f258-49ce-94e3-df41fc66f662"), {
      attempted: false,
      pending: true,
    });
    assert.equal(calls, 1);
  } finally {
    if (previous.url === undefined) delete process.env.GYM_SYNC_SERVER_URL;
    else process.env.GYM_SYNC_SERVER_URL = previous.url;
    if (previous.token === undefined) delete process.env.GYM_SYNC_API_TOKEN;
    else process.env.GYM_SYNC_API_TOKEN = previous.token;
    if (previous.device === undefined) delete process.env.DEFAULT_ZK_DEVICE_SN;
    else process.env.DEFAULT_ZK_DEVICE_SN = previous.device;
    globalThis.fetch = previous.fetch;
  }
});
