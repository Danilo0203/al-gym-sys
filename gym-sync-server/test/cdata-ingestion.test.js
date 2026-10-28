const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");

// Replace the complete DB module before importing the app: these HTTP tests
// never create a PostgreSQL pool and never connect to a physical clock.
const insertedRows = [];
const localDbPath = require.resolve("../local-db");
const fakeDb = {
  ready: async () => {},
  close: async () => {},
  insertAttendance: async (rows) => { insertedRows.push(...rows); },
};
require.cache[localDbPath] = {
  id: localDbPath,
  filename: localDbPath,
  loaded: true,
  exports: { createLocalDbFromEnvironment: () => fakeDb },
};
Object.assign(process.env, {
  NODE_ENV: "test",
  SYNC_API_TOKEN: "isolated-cdata-test-token",
  SYNC_COMMAND_DELIVERY_PAUSED: "true",
  ZK_DEVICE_IP: "",
  ZK_TIME_UTC_OFFSET: "-06:00",
});
const { app } = require("../index");
let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  delete require.cache[localDbPath];
});

async function push(body) {
  const response = await fetch(`${baseUrl}/iclock/cdata?SN=SYNTHETIC_CLOCK`, { method: "POST", body });
  return { status: response.status, body: await response.text() };
}

const userRow = "CardNo=\tPin=363\tPassword=\tGroup=1\tStartTime=0\tEndTime=0\tName=Test User\tPrivilege=0\tDisable=0\tVerify=0";

test("Security PUSH query uploads acknowledge the table and received row count", async () => {
  const response = await fetch(`${baseUrl}/iclock/querydata?SN=SYNTHETIC_CLOCK&type=tabledata&tablename=userauthorize&cmdid=9&count=2`, {
    method: "POST", body: "Pin=1\tAuthorizeTimezoneId=1\nPin=2\tAuthorizeTimezoneId=1\n",
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "userauthorize=2");
});

test("empty firmware table query padding is acknowledged as zero records", async () => {
  const response = await fetch(`${baseUrl}/iclock/querydata?SN=SYNTHETIC_CLOCK&type=tabledata&tablename=userauthorize&cmdid=10&count=0`, {
    method: "POST", body: "\0".repeat(524288),
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "userauthorize=0");
});

test("acknowledges USER metadata without inserting attendance or requesting retry", async () => {
  const beforeCount = insertedRows.length;
  assert.deepEqual(await push(userRow), { status: 200, body: "OK" });
  assert.equal(insertedRows.length, beforeCount);
});

test("USER metadata does not block valid attendance in the same push", async () => {
  const beforeCount = insertedRows.length;
  const event = "Pin=363\tTime=2026-10-28 10:20:30\tEvent=0\tVerifyType=1";
  assert.deepEqual(await push(`${userRow}\n${event}`), { status: 200, body: "OK" });
  assert.equal(insertedRows.length, beforeCount + 1);
  assert.equal(insertedRows.at(-1).punch_time, "2026-10-28T16:20:30.000Z");
});

test("genuinely malformed access events remain retryable and are not saved", async () => {
  const beforeCount = insertedRows.length;
  assert.deepEqual(await push("Pin=363\tTime=bad-date\tEvent=0"), { status: 503, body: "ERROR" });
  assert.equal(insertedRows.length, beforeCount);
});

test("acknowledges zero-PIN events as structured device metadata, not attendance", async (t) => {
  const log = t.mock.method(console, "info", () => {});
  const beforeCount = insertedRows.length;
  const line = "Time=2026-10-22 21:44:11\tPin=0\tCardNo=private-card\tEvent=27\tIndex=52";
  assert.deepEqual(await push(line), { status: 200, body: "OK" });
  assert.equal(insertedRows.length, beforeCount);
  assert.equal(log.mock.callCount(), 1);
  assert.equal(log.mock.calls[0].arguments[0], "DEVICE_EVENT_NO_PERSON");
  const metadata = JSON.parse(log.mock.calls[0].arguments[1]);
  assert.equal(metadata.device_id, "SYNTHETIC_CLOCK");
  assert.equal(metadata.time, "2026-10-23T03:44:11.000Z");
  assert.equal(metadata.event, 27);
  assert.equal(metadata.index, 52);
  assert.equal(JSON.stringify(metadata).includes("private-card"), false);
});

test("a mixed push saves people and acknowledges non-person events", async (t) => {
  const log = t.mock.method(console, "info", () => {});
  const beforeCount = insertedRows.length;
  const deviceEvent = "Time=2026-10-22 21:44:11\tPin=0\tEvent=27\tIndex=52";
  const attendance = "Time=2026-10-28 11:30:00\tPin=363\tEvent=0\tVerifyType=1";
  assert.deepEqual(await push(`${userRow}\n${deviceEvent}\n${attendance}`), { status: 200, body: "OK" });
  assert.equal(insertedRows.length, beforeCount + 1);
  assert.equal(insertedRows.at(-1).biometric_id, 363);
  assert.equal(log.mock.callCount(), 1);
});

test("malformed zero-PIN events still request retry rather than being discarded", async () => {
  const beforeCount = insertedRows.length;
  for (const line of [
    "Time=bad-date\tPin=0\tEvent=27",
    "Time=2026-10-22 21:44:11\tPin=0\tEvent=bad",
    "Time=2026-10-22 21:44:11\tPin=0",
  ]) assert.deepEqual(await push(line), { status: 503, body: "ERROR" });
  assert.equal(insertedRows.length, beforeCount);
});
