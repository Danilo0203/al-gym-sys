const { isIP } = require("node:net");

function isLocalClockAddress(value) {
  if (typeof value !== "string" || isIP(value) !== 4) return false;
  const [first, second] = value.split(".").map(Number);
  return first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254) ||
    first === 127;
}

module.exports = { isLocalClockAddress };
