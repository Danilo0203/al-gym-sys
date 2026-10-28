const ZKAttendanceClient = require("zk-attendance-sdk");

function createClockUserInventory({ ip, port, serial, timeout = 8000, cacheMs = 120000 }) {
  let cached = null;
  let pending = null;
  async function read() {
    const client = new ZKAttendanceClient(ip, port, timeout, 0);
    try {
      await client.createSocket();
      if (client.connectionType !== "tcp") throw new Error("clock_inventory_requires_tcp");
      const actualSerial = String(await client.getSerialNumber()).replace(/\0/g, "").trim();
      if (actualSerial !== serial) throw new Error("clock_serial_mismatch");
      const info = await client.getInfo();
      const originalRead = client.jtcp.readWithBuffer.bind(client.jtcp);
      client.jtcp.readWithBuffer = async (...args) => {
        const result = await originalRead(...args);
        if (result.err) throw result.err;
        const bytes = result.data;
        if (!Buffer.isBuffer(bytes) || bytes.length < 4 || (bytes.length - 4) % 72 !== 0 ||
            (bytes.length - 4) / 72 !== info.userCounts || bytes.readUInt32LE(0) !== bytes.length - 4) {
          throw new Error("incomplete_clock_user_inventory");
        }
        return result;
      };
      const users = (await client.getUsers()).data;
      const pins = new Set(users.map((user) => Number(user.userId)).filter((pin) => Number.isInteger(pin) && pin > 0));
      cached = { pins, capturedAt: Date.now() };
      return pins;
    } finally {
      try { await client.disconnect(); } catch {}
    }
  }
  return {
    async getKnownUserPins(deviceId) {
      if (!ip || !serial) return null;
      if (deviceId !== serial) throw new Error("unexpected_clock_serial");
      if (cached && Date.now() - cached.capturedAt < cacheMs) return cached.pins;
      if (!pending) pending = read().finally(() => { pending = null; });
      return pending;
    },
    invalidate() { cached = null; },
  };
}

module.exports = { createClockUserInventory };
