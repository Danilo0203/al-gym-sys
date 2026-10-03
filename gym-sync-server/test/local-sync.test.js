const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { randomBytes, randomUUID } = require("node:crypto");
const { before, after, test } = require("node:test");
const { Pool } = require("pg");

const { readDatabaseConfig } = require("../local-db");

const role = `algym_sync_test_${randomBytes(4).toString("hex")}`;
const password = randomBytes(24).toString("hex");
const token = randomBytes(24).toString("hex");
const deviceId = `SYNCTEST${randomBytes(4).toString("hex")}`;
const reconcileDeviceId = `SYNCTEST${randomBytes(4).toString("hex")}`;
const targetedDeviceId = `SYNCTEST${randomBytes(4).toString("hex")}`;
const firstReconcileBiometricId = 700000 + (randomBytes(4).readUInt32BE(0) % 100000);
const reconcileBiometricIds = Array.from({ length: 7 }, (_, index) => firstReconcileBiometricId + index);
const customerIds = [];
let planId = null;
let server;
let baseUrl;
let sync;

function adminSql(sql) {
  return execFileSync("psql", ["-d", "algym_test", "-v", "ON_ERROR_STOP=1", "-qAt"], {
    input: sql,
    encoding: "utf8",
  }).trim();
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  return {
    status: response.status,
    text,
    body: response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : null,
  };
}

function authHeaders() {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

before(async () => {
  adminSql(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'; GRANT algym_sync TO ${role};`);
  Object.assign(process.env, {
    NODE_ENV: "test",
    DB_HOST: "127.0.0.1",
    DB_PORT: "5432",
    DB_NAME: "algym_test",
    DB_USER: role,
    DB_PASSWORD: password,
    SYNC_API_TOKEN: token,
    ZK_DEVICE_IP: "",
    ZK_TIME_UTC_OFFSET: "-06:00",
    COMMAND_LOCK_MS: "50",
    DEVICE_RECONCILE_COOLDOWN_MS: "120000",
  });
  sync = require("../index");
  await sync.db.ready();
  server = sync.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (sync) await sync.db.close();
  adminSql(`DELETE FROM public.attendance_logs WHERE device_id IN ('${deviceId}', '${reconcileDeviceId}', '${targetedDeviceId}');
    DELETE FROM public.device_commands
      WHERE device_id IN ('${deviceId}', '${reconcileDeviceId}', '${targetedDeviceId}')
         OR command ~ 'Pin=(${reconcileBiometricIds.join("|")})([^0-9]|$)';
    DELETE FROM public.subscriptions WHERE user_id IN (${customerIds.map((id) => `'${id}'`).join(",") || "NULL"});
    DELETE FROM public.profiles WHERE id IN (${customerIds.map((id) => `'${id}'`).join(",") || "NULL"});
    DELETE FROM auth.users WHERE id IN (${customerIds.map((id) => `'${id}'`).join(",") || "NULL"});
    ${planId ? `DELETE FROM public.plans WHERE id = ${planId};` : ""}
    DROP ROLE ${role};`);
});

test("la configuración impide conectar sync al VPS o usar un rol amplio", () => {
  const config = { NODE_ENV: "production", DB_HOST: "127.0.0.1", DB_NAME: "algym",
    DB_USER: "algym_sync", DB_PASSWORD: "test" };
  assert.equal(readDatabaseConfig(config).max, 4);
  assert.throws(() => readDatabaseConfig({ ...config, DB_HOST: "203.0.113.7" }));
  assert.throws(() => readDatabaseConfig({ ...config, DB_USER: "algym_app" }));
  assert.throws(() => readDatabaseConfig({ ...config, DB_PASSWORD: "" }));
});

test("marcajes del reloj usan hora de Guatemala y rechazan PIN inválido", () => {
  assert.equal(sync.parseAttlogLine("ATTLOG 123 2026-09-29 09:30:00 0 1", deviceId).punch_time,
    "2026-09-29T15:30:00.000Z");
  assert.equal(sync.parseAttlogLine("ATTLOG 0 2026-09-29 09:30:00 0 1", deviceId), null);
  assert.equal(sync.parseAccessEventLine("Pin=123\tTime=2026-09-29 09:30:00\tEvent=0", deviceId).punch_time,
    "2026-09-29T15:30:00.000Z");
});

test("rol limitado, cola ZKTeco, confirmación por SN y asistencia deduplicada", async () => {
  const restricted = new Pool(readDatabaseConfig(process.env));
  try {
    await assert.rejects(restricted.query("SELECT id FROM auth.users LIMIT 1"), /permission denied/);
    await assert.rejects(restricted.query("SELECT id FROM public.payments LIMIT 1"), /permission denied/);
  } finally {
    await restricted.end();
  }

  assert.equal((await api("/api/attendance")).status, 401);
  assert.equal((await api(`/api/attendance?token=${token}`)).status, 401);
  assert.equal((await api("/health/ready")).status, 200);

  const remoteDevice = await api("/api/device-users/register", {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify({ device_id: deviceId, biometric_id: 12345, full_name: "Prueba Local", device_ip: "8.8.8.8" }),
  });
  assert.equal(remoteDevice.status, 400);
  assert.equal(remoteDevice.body.error, "invalid_device_ip");

  const registered = await api("/api/device-users/register", {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify({ device_id: deviceId, biometric_id: 12345, full_name: "Prueba Local" }),
  });
  assert.equal(registered.status, 200);
  assert.equal(registered.body.method, "queue");
  assert.equal(registered.body.queue.commands.length, 2);

  const poll = await api(`/iclock/getrequest?SN=${deviceId}`);
  assert.equal(poll.status, 200);
  assert.match(poll.text, /^C:\d+:DATA UPDATE user /);
  const commandId = Number(poll.text.match(/^C:(\d+):/)[1]);
  assert.equal((await api(`/iclock/getrequest?SN=${deviceId}`)).text, "OK");
  await new Promise((resolve) => setTimeout(resolve, 65));
  assert.equal((await api(`/iclock/getrequest?SN=${deviceId}`)).text, poll.text);
  assert.equal((await api(`/iclock/devicecmd?SN=OTRO_RELOJ&ID=${commandId}&Return=0`,
    { method: "POST", body: "" })).status, 200);
  const beforeAck = await api(`/api/device-commands?device_id=${deviceId}&executed=false`,
    { headers: authHeaders() });
  assert.ok(beforeAck.body.data.some((command) => command.id === commandId));
  assert.equal((await api(`/iclock/devicecmd?SN=${deviceId}&ID=${commandId}&Return=0`,
    { method: "POST", body: "" })).status, 200);
  const afterAck = await api(`/api/device-commands?device_id=${deviceId}&executed=false`,
    { headers: authHeaders() });
  assert.equal(afterAck.body.data.some((command) => command.id === commandId), false);

  const line = "ATTLOG 12345 2026-09-29 09:30:00 0 1";
  assert.equal((await api("/iclock/cdata", { method: "POST", body: line })).status, 400);
  assert.equal((await api(`/iclock/cdata?SN=${deviceId}`, { method: "POST", body: line })).status, 200);
  assert.equal((await api(`/iclock/cdata?SN=${deviceId}`, { method: "POST", body: line })).status, 200);
  const attendance = await api(`/api/attendance?device_id=${deviceId}`, { headers: authHeaders() });
  assert.equal(attendance.status, 200);
  assert.equal(attendance.body.data.length, 1);
  assert.equal(attendance.body.data[0].punch_time, "2026-09-29T15:30:00.000Z");

  const missingStatus = "ATTLOG 12345 2026-09-29 09:31:00 0";
  assert.equal((await api(`/iclock/cdata?SN=${deviceId}`, { method: "POST", body: missingStatus })).status, 200);
  assert.equal((await api(`/iclock/cdata?SN=${deviceId}`, { method: "POST", body: missingStatus })).status, 200);
  assert.equal((await api(`/iclock/cdata?SN=${deviceId}`, {
    method: "POST", body: "ATTLOG 12345 2026-99-29 09:32:00 0",
  })).status, 503);
  const finalAttendance = await api(`/api/attendance?device_id=${deviceId}`, { headers: authHeaders() });
  assert.equal(finalAttendance.body.data.length, 2);
  const sameDay = await api(`/api/attendance?device_id=${deviceId}&date_from=2026-09-29&date_to=2026-09-29`,
    { headers: authHeaders() });
  assert.equal(sameDay.body.data.length, 2);
  const priorDay = await api(`/api/attendance?device_id=${deviceId}&date_to=2026-09-28`,
    { headers: authHeaders() });
  assert.equal(priorDay.body.data.length, 0);
  assert.equal((await api("/api/attendance?date_to=ayer", { headers: authHeaders() })).status, 400);

  const query = await api("/api/device-users/query", {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify({ device_id: deviceId, biometric_id: 12345, full_name: "Prueba Local" }),
  });
  assert.equal(query.status, 200);
  assert.equal(query.body.queued, true);
  const disable = await api("/api/device-users/disable", {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify({ device_id: deviceId, biometric_id: 12345, full_name: "Prueba Local" }),
  });
  assert.equal(disable.status, 200);
  assert.equal(disable.body.queued, true);
  const finalCommands = await api(`/api/device-commands?device_id=${deviceId}&executed=false`,
    { headers: authHeaders() });
  assert.ok(finalCommands.body.data.some((command) => command.command === query.body.command));
  assert.ok(finalCommands.body.data.some((command) => command.command === disable.body.commands[0]));
});

test("reconciliación local habilita membresía vigente y deshabilita vencida", async () => {
  planId = Number(adminSql(`INSERT INTO public.plans (name, price, duration_days)
    VALUES ('ZZTEST SYNC ${randomUUID()}', 100, 30) RETURNING id;`));
  assert.ok(planId > 0);
  const cases = [
    { startDate: "current_date - 20", endDate: "current_date + 5", active: true },
    { startDate: "current_date - 20", endDate: "current_date - 4", active: true },
    { startDate: "current_date - 20", endDate: "current_date - 1", active: true },
    { startDate: null, endDate: null, active: true },
    { startDate: "current_date + 1", endDate: "current_date + 30", active: true },
    { startDate: "current_date - 20", endDate: "current_date + 5", active: false },
    { startDate: "current_date + 1", endDate: "current_date + 30", active: true, pending: true },
  ];
  for (const [index, { startDate, endDate, active, pending }] of cases.entries()) {
    const id = randomUUID();
    customerIds.push(id);
    adminSql(`INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
      VALUES ('${id}', '${id}@sync.test.local', '{}'::jsonb, now(), now());
      INSERT INTO public.profiles (id, full_name, phone, birth_date, role, biometric_id, is_active)
      VALUES ('${id}', 'ZZTEST SYNC ${index}', '', DATE '1990-01-01', 'client', ${reconcileBiometricIds[index]}, ${active});
      ${endDate ? `INSERT INTO public.subscriptions (user_id, plan_id, start_date, end_date, status)
       VALUES ('${id}', ${planId}, ${startDate}, ${endDate}, '${pending ? "pending" : "active"}');` : ""}`);
  }

  const result = await api("/api/device-users/reconcile", {
    method: "POST", headers: authHeaders(), body: JSON.stringify({ device_id: reconcileDeviceId }),
  });
  assert.equal(result.status, 200);
  assert.ok(result.body.queued_commands >= 8);
  assert.ok(result.body.enabled_users >= 3);
  assert.ok(result.body.disabled_users >= 4);
  assert.equal(result.body.expired_subscriptions, 1);
  const commands = await api(`/api/device-commands?device_id=${reconcileDeviceId}&executed=false`,
    { headers: authHeaders() });
  assert.ok(commands.body.data.some((row) => row.command.includes(`Pin=${reconcileBiometricIds[0]}`) && row.command.includes("Name=")));
  assert.ok(commands.body.data.some((row) => row.command === `DATA DELETE userauthorize Pin=${reconcileBiometricIds[1]}`));
  assert.ok(commands.body.data.some((row) => row.command.includes(`Pin=${reconcileBiometricIds[2]}`) && row.command.includes("Name=")));
  assert.ok(commands.body.data.some((row) => row.command === `DATA DELETE userauthorize Pin=${reconcileBiometricIds[3]}`));
  assert.ok(commands.body.data.some((row) => row.command.includes(`Pin=${reconcileBiometricIds[4]}`) && row.command.includes("Name=")));
  assert.ok(commands.body.data.some((row) => row.command === `DATA DELETE userauthorize Pin=${reconcileBiometricIds[5]}`));
  assert.ok(commands.body.data.some((row) => row.command === `DATA DELETE userauthorize Pin=${reconcileBiometricIds[6]}`));
  const states = adminSql(`SELECT status::text FROM public.subscriptions
    WHERE user_id = '${customerIds[1]}';`);
  assert.equal(states, "expired");
  assert.equal(adminSql(`SELECT status::text FROM public.subscriptions WHERE user_id = '${customerIds[2]}';`), "active");

  assert.equal((await api("/api/device-users/reconcile", {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify({ device_id: targetedDeviceId, customer_id: "bad-id" }),
  })).status, 400);
  assert.equal((await api("/api/device-users/reconcile", {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify({ device_id: targetedDeviceId, customer_id: randomUUID() }),
  })).status, 404);

  const targeted = await api("/api/device-users/reconcile", {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify({ device_id: targetedDeviceId, customer_id: customerIds[2] }),
  });
  assert.equal(targeted.status, 200);
  assert.equal(targeted.body.profiles_considered, 1);
  assert.equal(targeted.body.enabled_users, 1);
  assert.equal(targeted.body.disabled_users, 0);
  assert.equal(targeted.body.queued_commands, 2);
  const targetedCommands = await api(`/api/device-commands?device_id=${targetedDeviceId}&executed=false`,
    { headers: authHeaders() });
  assert.ok(targetedCommands.body.data.every((row) => row.command.includes(`Pin=${reconcileBiometricIds[2]}`)));
});
