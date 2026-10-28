const test = require("node:test");
const assert = require("node:assert/strict");
const rows = [1, 2, 3].map((id) => ({ id, command: `DATA QUERY tablename=userauthorize,fielddesc=*,filter=Pin=${id}`, executed: false }));
const dbPath = require.resolve("../local-db");
const fakeDb = {
  expirePastDueSubscriptions: async () => [],
  loadProfilesForReconcile: async () => [],
  loadActiveSubscriptionUserIds: async () => new Set(),
  reconcileCommandState: async () => ({ queued_commands: 0, superseded_commands: 0 }),
  listPendingCommands: async () => rows.filter((row) => !row.executed),
  markCommandExecuted: async (id, returnCode) => {
    const row = rows.find((entry) => entry.id === id && !entry.executed);
    if (!row) return false;
    row.executed = true; row.return_code = returnCode; return true;
  },
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { createLocalDbFromEnvironment: () => fakeDb } };
Object.assign(process.env, { NODE_ENV: "test", SYNC_API_TOKEN: "isolated-delivery", ZK_DEVICE_IP: "", ZK_DEVICE_SERIAL: "SYNTHETIC", SYNC_COMMAND_DELIVERY_PAUSED: "false", ZK_COMMAND_BATCH_SIZE: "2" });
const { app } = require("../index");
test("bounded delivery waits for every confirmation and preserves remaining work", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const poll = async () => (await fetch(`${base}/iclock/getrequest?SN=SYNTHETIC`)).text();
  try {
    assert.equal(await (await fetch(`${base}/iclock/ping?SN=SYNTHETIC`)).text(), "OK");
    assert.equal((await fetch(`${base}/iclock/getrequest?SN=OTHER`)).status, 400);
    const first = await poll();
    assert.match(first, /^C:1:/); assert.match(first, /\nC:2:/); assert.doesNotMatch(first, /C:3:/);
    assert.equal(await poll(), "OK");
    await fetch(`${base}/iclock/devicecmd?SN=SYNTHETIC`, { method: "POST", body: "ID=1&Return=0&CMD=DATA" });
    assert.equal(await poll(), "OK");
    await fetch(`${base}/iclock/devicecmd?SN=SYNTHETIC`, { method: "POST", body: "ID=2&Return=0&CMD=DATA" });
    assert.match(await poll(), /^C:3:/);
    await fetch(`${base}/iclock/devicecmd?SN=SYNTHETIC`, { method: "POST", body: "ID=3" });
    assert.equal(rows[2].executed, false);
    await fetch(`${base}/iclock/devicecmd?SN=SYNTHETIC`, { method: "POST", body: "ID=3&Return=0&CMD=DATA" });
    assert.equal(await poll(), "OK");
    assert.equal(rows.filter((row) => row.return_code === "0").length, 3);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
