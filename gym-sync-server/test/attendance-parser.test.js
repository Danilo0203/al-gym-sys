const assert = require("node:assert/strict");
const test = require("node:test");
const { createAttendanceParsers } = require("../attendance-parser");

const parser = createAttendanceParsers("-06:00");

test("retains ATTLOG formats and Guatemala timestamps without a database", () => {
  for (const line of [
    "ATTLOG 123 2026-09-29 09:30:00 0 1",
    "123\t2026-09-29 09:30:00\t0\t1",
    "ATTLOG\t123\t2026-09-29 09:30:00\t0\t1",
  ]) {
    const row = parser.parseAttlogLine(line, "CLOCK_TEST");
    assert.equal(row.biometric_id, 123);
    assert.equal(row.punch_time, "2026-09-29T15:30:00.000Z");
    assert.equal(row.status2, 1);
  }
  assert.equal(parser.parseAttlogLine("ATTLOG 0 2026-09-29 09:30:00 0 1", "TEST"), null);
  assert.equal(parser.parseAttlogLine("ATTLOG 123 2026-99-29 09:30:00", "TEST"), null);
});

test("retains tab-separated access events and explicit offsets", () => {
  const row = parser.parseAccessEventLine("Pin=123\tTime=2026-09-29 09:30:00\tEvent=0\tVerifyType=1", "CLOCK_TEST");
  assert.equal(row.punch_time, "2026-09-29T15:30:00.000Z");
  assert.equal(row.status1, 0);
  assert.equal(row.status2, 1);
  assert.equal(parser.parseAccessEventLine("Pin=123\tTime=2026-09-29 09:30:00Z", "TEST").punch_time,
    "2026-09-29T09:30:00.000Z");
});

test("USER rows with StartTime and EndTime are metadata, not attendance", () => {
  const userRow = "CardNo=\tPin=363\tPassword=\tGroup=1\tStartTime=0\tEndTime=0\tName=Test User\tPrivilege=0\tDisable=0\tVerify=0";
  assert.equal(parser.isAccessEventLine(userRow), false);
  assert.equal(parser.isAccessEventLine("Pin=363\tStartTime=0"), false);
  assert.equal(parser.isAccessEventLine("Pin=363\tEndTime=0"), false);
  assert.equal(parser.isAccessEventLine("Pin=363\tTime=2026-10-28 10:20:30\tEvent=0"), true);
  assert.equal(parser.isAccessEventLine("PIN=363\tTIME=bad-date"), true);
});

test("diagnostics distinguish zero PIN, malformed separators and invalid dates", () => {
  const zeroPin = "Pin=0\tTime=2026-09-29 09:30:00\tEvent=2";
  assert.equal(parser.parseAccessEventLine(zeroPin, "TEST"), null);
  assert.equal(parser.describeInvalidAccessEvent(zeroPin).pin_state, "zero");
  assert.deepEqual(parser.describeInvalidAccessEvent(zeroPin).reasons, ["invalid_pin"]);
  const spaces = parser.describeInvalidAccessEvent("Pin=123 Time=2026-09-29 09:30:00 Event=0");
  assert.equal(spaces.separators.tabs, 0);
  assert.equal(spaces.pin_state, "invalid");
  assert.deepEqual(spaces.reasons, ["invalid_pin", "invalid_time"]);
  const badTime = parser.describeInvalidAccessEvent("Pin=123\tTime=2026-99-29 09:30:00");
  assert.equal(badTime.pin_state, "positive");
  assert.deepEqual(badTime.reasons, ["invalid_time"]);
});

test("zero-PIN device events preserve safe metadata without creating attendance", () => {
  const line = "Time=2026-10-22 21:44:11\tPin=0\tCardNo=private-card\tEvent=27\tIndex=52\tTemperature=private-value";
  assert.equal(parser.parseAccessEventLine(line, "TEST"), null);
  const event = parser.parseNonPersonAccessEvent(line, "TEST");
  assert.equal(event.device_id, "TEST");
  assert.equal(event.time, "2026-10-23T03:44:11.000Z");
  assert.equal(event.event, 27);
  assert.equal(event.index, 52);
  assert.match(event.sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(event).includes("private-"), false);
  assert.deepEqual(Object.keys(event), ["device_id", "time", "event", "index", "sha256"]);
  assert.equal(parser.describeInvalidAccessBatch([line]).invalid_count, 0);
});

test("non-person acknowledgement requires explicit zero PIN, valid time and numeric event", () => {
  for (const line of [
    "Time=2026-10-22 21:44:11\tEvent=27",
    "Time=2026-10-22 21:44:11\tPin=-1\tEvent=27",
    "Time=2026-10-22 21:44:11\tPin=bad\tEvent=27",
    "Time=bad-date\tPin=0\tEvent=27",
    "Time=2026-10-22 21:44:11\tPin=0",
    "Time=2026-10-22 21:44:11\tPin=0\tEvent=bad",
    "Time=2026-10-22 21:44:11\tPin=0\tEvent=-1",
  ]) assert.equal(parser.parseNonPersonAccessEvent(line, "TEST"), null, line);
});

test("diagnostics omit template, password, name and arbitrary field values", () => {
  const line = "Pin=secret-pin\tTime=secret-time\tEvent=secret-event\tTemplate=secret-template\tPassword=secret-password\tName=secret-name";
  const diagnostic = parser.describeInvalidAccessEvent(line);
  assert.equal(diagnostic.pin, null);
  assert.equal(diagnostic.time, null);
  assert.equal(diagnostic.event, null);
  assert.equal(JSON.stringify(diagnostic).includes("secret-"), false);
  assert.deepEqual(diagnostic.keys, ["pin", "time", "event", "template", "password", "name"]);
  assert.match(diagnostic.sha256, /^[a-f0-9]{64}$/);
});

test("batch fingerprint identifies identical retries and bounds samples", () => {
  const lines = Array.from({ length: 8 }, (_, index) => `Pin=-1\tTime=2026-09-29 09:30:00\tEvent=${index}`);
  const first = parser.describeInvalidAccessBatch(lines);
  assert.equal(first.sha256, parser.describeInvalidAccessBatch([...lines]).sha256);
  assert.notEqual(first.sha256, parser.describeInvalidAccessBatch(lines.slice(1)).sha256);
  assert.equal(first.line_count, 8);
  assert.equal(first.invalid_count, 8);
  assert.equal(first.samples.length, 3);
});
