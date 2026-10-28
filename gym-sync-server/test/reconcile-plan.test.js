const assert = require("node:assert/strict");
const { test } = require("node:test");
const { classifyStateCommand, planDeviceReconciliation, SUPERSEDED_RETURN_CODE } = require("../reconcile-plan");
const { createLocalDb } = require("../local-db");

const enable = (pin) => `DATA UPDATE userauthorize Pin=${pin}\tAuthorizeTimezoneId=1\tAuthorizeDoorId=1`;
const disable = (pin) => `DATA DELETE userauthorize Pin=${pin}`;
const profile = (pin, name = "TEST") => `DATA UPDATE user CardNo=\tPin=${pin}\tPassword=\tGroup=1\tStartTime=0\tEndTime=0\tName=${name}\tPrivilege=0`;
const row = (id, command, executed = false, return_code = null) => ({ id: String(id), command, executed, return_code });
function plan(commands, history, options = {}) {
  return planDeviceReconciliation({ desiredStates: [{ pin: 56, commands }], history, ...options });
}

test("confirmed state stays idempotent after every command has left the pending queue", () => {
  const history = [row(1, profile(56), true, "0"), row(2, enable(56), true, "0")];
  assert.deepEqual(plan([profile(56), enable(56)], history).commands, []);
  assert.deepEqual(plan([profile(56), enable(56)], history).supersededIds, []);
});

test("renewal replaces a stale revoke and duplicate grants without deleting history", () => {
  const result = plan([enable(56)], [row(1, disable(56)), row(2, enable(56)), row(3, enable(56))]);
  assert.deepEqual(result.supersededIds, ["1", "2"]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.supersededReturnCode, SUPERSEDED_RETURN_CODE);
});

test("latest successful opposite state invalidates an older grant", () => {
  const history = [row(1, enable(56), true, "0"), row(2, disable(56), true, "0")];
  assert.deepEqual(plan([enable(56)], history).commands, [enable(56)]);
});

test("failed and empty acknowledgements never count as success", () => {
  for (const code of [null, "", "-629", "SKIPPED_DUPLICATE", SUPERSEDED_RETURN_CODE]) {
    assert.deepEqual(plan([enable(56)], [row(1, enable(56), true, code)]).commands, [enable(56)]);
  }
  assert.deepEqual(plan([enable(56)], [row(1, enable(56), true, "7")], { successReturns: ["7"] }).commands, []);
  assert.deepEqual(plan([enable(56)], [row(1, enable(56), true, "0"), row(2, enable(56), true, "-1")]).commands, [enable(56)]);
});

test("administrative retirement does not replace the last actual device confirmation", () => {
  const history = [row(1, enable(56), true, "0"), row(2, disable(56), true, SUPERSEDED_RETURN_CODE)];
  assert.deepEqual(plan([enable(56)], history).commands, []);
});

test("user inventory protects existing users from stale metadata overwrites", () => {
  // The caller omits a profile command when the inventory already has that PIN.
  const result = plan([enable(56)], [row(1, profile(56, "OLD")), row(2, enable(56), true, "0")]);
  assert.deepEqual(result.supersededIds, ["1"]);
  assert.deepEqual(result.commands, []);
});

test("expiry retires pending creation and grant and queues only authorization removal", () => {
  const result = plan([disable(56)], [row(1, profile(56)), row(2, enable(56))]);
  assert.deepEqual(result.supersededIds, ["1", "2"]);
  assert.deepEqual(result.commands, [disable(56)]);
});

test("only managed state for the target PIN can be retired", () => {
  const untouched = [
    "DATA DELETE user Pin=56", "DATA DELETE templatev10 Pin=56\tFingerID=0",
    "DATA UPDATE templatev10 Pin=56\tFingerID=1", "ENROLL_USER PIN=56",
    "DATA QUERY tablename=user,fielddesc=*,filter=Pin=56", "REBOOT", enable(57),
    "DATA UPDATE userauthorize Pin=56 Pin=57", "DATA DELETE userauthorize Pin=0",
  ];
  const result = plan([enable(56)], untouched.map((command, i) => row(i + 1, command)));
  assert.deepEqual(result.supersededIds, []);
  assert.deepEqual(result.commands, [enable(56)]);
  for (const command of untouched.filter((command) => command !== enable(57))) {
    assert.equal(classifyStateCommand(command), null);
  }
});

test("legacy unsupported USERINFO is retired when a supported profile is needed", () => {
  const result = plan([profile(56), enable(56)], [row(1, "DATA UPDATE USERINFO PIN=56 Name=Old Pri=0")]);
  assert.deepEqual(result.supersededIds, ["1"]);
  assert.deepEqual(result.commands, [profile(56), enable(56)]);
});

test("an in-flight revoke is preserved and followed by a correcting grant", () => {
  const result = plan([enable(56)], [row(1, enable(56), true, "0"), row(2, disable(56))], { protectedCommandIds: ["2"] });
  assert.deepEqual(result.supersededIds, []);
  assert.deepEqual(result.commands, [enable(56)]);
});

test("matching in-flight commands prevent duplicates while later contradictory state is retired", () => {
  const result = plan([enable(56)], [row(1, enable(56)), row(2, disable(56)), row(3, enable(56))], { protectedCommandIds: ["1"] });
  assert.deepEqual(result.supersededIds, ["2", "3"]);
  assert.deepEqual(result.commands, []);
});

test("a batch with a grant followed by an in-flight revoke requires a new final grant", () => {
  const result = plan([enable(56)], [row(1, enable(56)), row(2, disable(56))], { protectedCommandIds: ["1", "2"] });
  assert.deepEqual(result.supersededIds, []);
  assert.deepEqual(result.commands, [enable(56)]);
});

test("a stale conflicting command needs a corrective grant even after losing in-flight memory", () => {
  const result = plan([enable(56)], [row(1, enable(56), true, "0"), row(2, disable(56))]);
  assert.deepEqual(result.supersededIds, ["2"]);
  assert.deepEqual(result.commands, [enable(56)]);
});

test("inventory absence overrides an old successful profile creation", () => {
  const result = planDeviceReconciliation({
    desiredStates: [{ pin: 56, commands: [profile(56)], invalidateConfirmedFamilies: ["profile"] }],
    history: [row(1, profile(56), true, "0")],
  });
  assert.deepEqual(result.commands, [profile(56)]);
});

test("a queued grant before a retained creation is retired and queued after that creation", () => {
  const result = planDeviceReconciliation({
    desiredStates: [{ pin: 378, commands: [profile(378), enable(378)], invalidateConfirmedFamilies: ["profile"] }],
    history: [row(22, enable(378)), row(25, profile(378))],
  });
  assert.deepEqual(result.supersededIds, ["22"]);
  assert.deepEqual(result.commands, [enable(378)]);
});

test("a grant already queued after retained creation stays idempotent", () => {
  const result = plan([profile(56), enable(56)], [row(25, profile(56)), row(30, enable(56))]);
  assert.deepEqual(result.supersededIds, []);
  assert.deepEqual(result.commands, []);
});

test("new creation retires an existing earlier grant and inserts creation before authorization", () => {
  const result = plan([profile(56), enable(56)], [row(22, enable(56))]);
  assert.deepEqual(result.supersededIds, ["22"]);
  assert.deepEqual(result.commands, [profile(56), enable(56)]);
});

test("a prior confirmed grant does not remove the need to authorize a recreated user", () => {
  const result = plan([profile(56), enable(56)], [row(22, enable(56), true, "0"), row(25, profile(56))]);
  assert.deepEqual(result.supersededIds, []);
  assert.deepEqual(result.commands, [enable(56)]);
});

test("an in-flight grant before creation is preserved but followed by a corrective authorization", () => {
  const result = plan([profile(56), enable(56)], [row(22, enable(56)), row(25, profile(56))], { protectedCommandIds: ["22"] });
  assert.deepEqual(result.supersededIds, []);
  assert.deepEqual(result.commands, [enable(56)]);
});

test("after creation and reordered grant confirm, reconciliation produces no further writes", () => {
  const history = [row(22, enable(56), true, SUPERSEDED_RETURN_CODE), row(25, profile(56), true, "0"), row(30, enable(56), true, "0")];
  assert.deepEqual(plan([profile(56), enable(56)], history).commands, []);
});

test("bigint command IDs retain chronological ordering beyond the JS safe integer limit", () => {
  const result = plan([enable(56)], [row("9007199254740993", disable(56), true, "0"), row("9007199254740992", enable(56), true, "0")]);
  assert.deepEqual(result.commands, [enable(56)]);
});

test("invalid or duplicate desired state fails instead of choosing an arbitrary access policy", () => {
  assert.throws(() => planDeviceReconciliation({ desiredStates: [{ pin: 56, commands: [enable(56), disable(56)] }], history: [] }));
  assert.throws(() => planDeviceReconciliation({ desiredStates: [{ pin: 56, commands: [enable(57)] }], history: [] }));
});

function fakePool({ failInsert = false } = {}) {
  const calls = [];
  let released = false;
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("SELECT id, command")) return { rows: [row(1, disable(56))] };
      if (sql.startsWith("UPDATE")) return { rowCount: 1, rows: [] };
      if (sql.startsWith("INSERT")) {
        if (failInsert) throw new Error("synthetic insertion failure");
        return { rowCount: 1, rows: [{ id: "2" }] };
      }
      return { rows: [], rowCount: 0 };
    },
    release() { released = true; },
  };
  return { pool: { connect: async () => client }, calls, isReleased: () => released };
}

test("database reconciliation serializes, retires and inserts in one transaction", async () => {
  const fake = fakePool();
  const result = await createLocalDb(fake.pool).reconcileCommandState("TEST_SERIAL", [56], (history) => plan([enable(56)], history));
  assert.deepEqual(result, { queued_commands: 1, superseded_commands: 1, command_ids: ["2"] });
  assert.equal(fake.calls[0].sql, "BEGIN");
  assert.match(fake.calls[1].sql, /pg_advisory_xact_lock/);
  assert.match(fake.calls[2].sql, /FOR UPDATE/);
  assert.deepEqual(fake.calls[3].params, ["TEST_SERIAL", ["1"], SUPERSEDED_RETURN_CODE]);
  assert.equal(fake.calls.at(-1).sql, "COMMIT");
  assert.equal(fake.isReleased(), true);
});

test("failed replacement rolls back retirement and always releases its connection", async () => {
  const fake = fakePool({ failInsert: true });
  await assert.rejects(() => createLocalDb(fake.pool).reconcileCommandState("TEST_SERIAL", [56], (history) => plan([enable(56)], history)), /synthetic insertion failure/);
  assert.equal(fake.calls.at(-1).sql, "ROLLBACK");
  assert.equal(fake.calls.some((call) => call.sql === "COMMIT"), false);
  assert.equal(fake.isReleased(), true);
});
