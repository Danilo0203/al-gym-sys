const assert = require("node:assert/strict");
const test = require("node:test");

const { isLocalClockAddress } = require("../local-clock-address");

test("la conexión directa del reloj solo admite IPv4 locales", () => {
  for (const address of ["10.0.0.20", "172.16.1.20", "172.31.255.20", "192.168.1.20", "169.254.1.20", "127.0.0.1"]) {
    assert.equal(isLocalClockAddress(address), true, address);
  }
  for (const address of ["8.8.8.8", "172.32.0.1", "192.169.1.1", "0.0.0.0", "localhost", "example.com", "::ffff:192.168.1.20", "192.168.1.999", "192.168.01.20", ""]) {
    assert.equal(isLocalClockAddress(address), false, address);
  }
});
