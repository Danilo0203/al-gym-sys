const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCommandConfirmations } = require("../command-confirmations");
test("individual, multiline and batched device confirmations preserve each result", () => {
  assert.deepEqual(parseCommandConfirmations("ID=1&Return=0&CMD=DATA"), [{ id: 1, returnCode: "0" }]);
  assert.deepEqual(parseCommandConfirmations("ID=1&Return=0&CMD=DATA\nID=2&Return=-629&CMD=DATA"),
    [{ id: 1, returnCode: "0" }, { id: 2, returnCode: "-629" }]);
  assert.deepEqual(parseCommandConfirmations("ID=3\nReturn=0\nCMD=DATA"), [{ id: 3, returnCode: "0" }]);
  assert.deepEqual(parseCommandConfirmations("", { ID: "4", Return: "0" }), [{ id: 4, returnCode: "0" }]);
});
test("missing or malformed confirmation is not accepted as success", () => {
  for (const body of ["ID=1", "ID=1&Return=", "ID=abc2&Return=0", "ID=0&Return=0"]) {
    assert.deepEqual(parseCommandConfirmations(body), []);
  }
});
