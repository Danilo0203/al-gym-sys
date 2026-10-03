const { isIP } = require("node:net");
const { Pool } = require("pg");

function isPrivateDatabaseHost(host) {
  const value = String(host || "").trim().toLowerCase();
  if (["localhost", "127.0.0.1", "::1", "db", "postgres", "host.docker.internal"].includes(value)) {
    return true;
  }
  if (isIP(value) !== 4) return false;
  const [first, second] = value.split(".").map(Number);
  return first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first === 127;
}

function readDatabaseConfig(environment = process.env) {
  const host = String(environment.DB_HOST || "").trim();
  const database = String(environment.DB_NAME || "").trim();
  const user = String(environment.DB_USER || "").trim();
  const password = String(environment.DB_PASSWORD || "");
  const port = Number(environment.DB_PORT || 5432);
  const allowedUser = user === "algym_sync" ||
    (environment.NODE_ENV === "test" && /^algym_sync_test_[a-z0-9]+$/.test(user));
  if (!isPrivateDatabaseHost(host) || !database || !allowedUser || !password ||
      !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Configuración inválida: sync requiere PostgreSQL local, rol algym_sync y contraseña");
  }
  return { host, port, database, user, password, max: 4, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000, application_name: "algym-sync" };
}

function createLocalDb(pool) {
  return {
    async ready() {
      await pool.query("SELECT 1");
    },
    async close() {
      await pool.end();
    },
    async findProfile(customerId) {
      const result = await pool.query(
        `SELECT biometric_id, full_name FROM public.profiles WHERE id = $1::uuid AND role = 'client' LIMIT 1`,
        [customerId],
      );
      return result.rows[0] || null;
    },
    async insertCommands(commands) {
      if (commands.length === 0) return;
      await pool.query(
        `INSERT INTO public.device_commands (device_id, command, executed)
         SELECT device_id, command, false
         FROM unnest($1::text[], $2::text[]) AS rows(device_id, command)`,
        [commands.map((row) => row.device_id), commands.map((row) => row.command)],
      );
    },
    async expirePastDueSubscriptions() {
      const result = await pool.query(
        `UPDATE public.subscriptions SET status = 'expired'
         WHERE status = 'active'
           AND public.subscription_access_until(end_date, grace_days)
               < (now() AT TIME ZONE 'America/Guatemala')::date
         RETURNING id, user_id, end_date`,
      );
      return result.rows;
    },
    async loadProfilesForReconcile() {
      const result = await pool.query(
        `SELECT id, role::text, full_name, biometric_id, is_active
         FROM public.profiles WHERE role = 'client' AND biometric_id IS NOT NULL`,
      );
      return result.rows;
    },
    async loadActiveSubscriptionUserIds() {
      const result = await pool.query(
        `SELECT DISTINCT user_id FROM public.subscriptions
          WHERE status = 'active'
            AND public.subscription_access_until(end_date, grace_days)
               >= (now() AT TIME ZONE 'America/Guatemala')::date`,
      );
      return new Set(result.rows.map((row) => row.user_id));
    },
    async loadPendingCommandSet(deviceId) {
      const result = await pool.query(
        `SELECT command FROM public.device_commands
         WHERE device_id = $1 AND executed = false
         ORDER BY created_at, id LIMIT 5000`,
        [deviceId],
      );
      return result.rows.map((row) => row.command);
    },
    async listPendingCommands(deviceId) {
      const result = await pool.query(
        `SELECT id, device_id, command, executed, created_at
         FROM public.device_commands
         WHERE device_id = $1 AND executed = false
         ORDER BY created_at, id LIMIT 20`,
        [deviceId],
      );
      return result.rows.map((row) => ({ ...row, id: Number(row.id) }));
    },
    async markCommandExecuted(id, returnCode, deviceId) {
      const result = await pool.query(
        `UPDATE public.device_commands
         SET executed = true, return_code = $2
         WHERE id = $1 AND device_id = $3 AND executed = false`,
        [id, returnCode, deviceId],
      );
      return result.rowCount > 0;
    },
    async insertAttendance(rows) {
      if (rows.length === 0) return;
      await pool.query(
        `INSERT INTO public.attendance_logs
           (device_id, biometric_id, punch_time, status1, status2, status3,
            status4, status5, raw_line, created_at)
         SELECT device_id, biometric_id, punch_time, status1, status2, status3,
                status4, status5, raw_line, created_at
         FROM jsonb_to_recordset($1::jsonb) AS event(
           device_id text, biometric_id integer, punch_time timestamptz,
           status1 integer, status2 integer, status3 integer, status4 integer,
           status5 integer, raw_line text, created_at timestamptz)
         ON CONFLICT DO NOTHING`,
        [JSON.stringify(rows)],
      );
    },
    async listAttendance({ limit, deviceId, biometricId, dateFrom, dateTo }) {
      const result = await pool.query(
        `SELECT device_id, biometric_id, punch_time, status1, status2, status3,
                status4, status5, raw_line, created_at
         FROM public.attendance_logs
         WHERE ($1::text IS NULL OR device_id = $1)
           AND ($2::integer IS NULL OR biometric_id = $2)
           AND ($3::date IS NULL OR punch_time >= ($3::date::timestamp AT TIME ZONE 'America/Guatemala'))
           AND ($4::date IS NULL OR punch_time < (($4::date + 1)::timestamp AT TIME ZONE 'America/Guatemala'))
         ORDER BY punch_time DESC, id DESC LIMIT $5`,
        [deviceId, biometricId, dateFrom, dateTo, limit],
      );
      return result.rows;
    },
    async listDeviceCommands({ limit, deviceId, executed }) {
      const result = await pool.query(
        `SELECT id, device_id, command, executed, return_code, created_at
         FROM public.device_commands
         WHERE ($1::text IS NULL OR device_id = $1)
           AND ($2::boolean IS NULL OR executed = $2)
         ORDER BY created_at DESC, id DESC LIMIT $3`,
        [deviceId, executed, limit],
      );
      return result.rows.map((row) => ({ ...row, id: Number(row.id) }));
    },
  };
}

function createLocalDbFromEnvironment(environment = process.env) {
  const pool = new Pool(readDatabaseConfig(environment));
  pool.on("error", (error) => console.error("Error en PostgreSQL del sync:", error));
  return createLocalDb(pool);
}

module.exports = { createLocalDb, createLocalDbFromEnvironment, readDatabaseConfig, isPrivateDatabaseHost };
