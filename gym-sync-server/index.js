require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { createClient } = require("@supabase/supabase-js");
const ZKAttendanceClient = require("zk-attendance-sdk");

const app = express();
const PORT = Number(process.env.PORT || 8080);
const REGISTRY_CODE = String(process.env.ZK_REGISTRY_CODE || "1");
const COMMAND_LOCK_MS = Number(process.env.COMMAND_LOCK_MS || 25000);
const SUCCESS_RETURNS = new Set(
  String(process.env.ZK_SUCCESS_RETURNS || "0")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
);
const ATTLOG_TABLE = process.env.ATTLOG_TABLE || "";
const ATTENDANCE_TABLE = process.env.ATTENDANCE_TABLE || "attendance_logs";
const API_TOKEN = process.env.SYNC_API_TOKEN || "";
const ZK_DEVICE_IP = String(process.env.ZK_DEVICE_IP || "").trim();
const ZK_DEVICE_PORT = Number(process.env.ZK_DEVICE_PORT || 4370);
const ZK_DEVICE_TIMEOUT = Number(process.env.ZK_DEVICE_TIMEOUT || 5000);
const ZK_DEVICE_INPORT = Number(process.env.ZK_DEVICE_INPORT || 5200);
const ZK_DEFAULT_USER_GROUP = Number(process.env.ZK_DEFAULT_USER_GROUP || 1);
const ZK_DEFAULT_AUTHORIZE_TIMEZONE_ID = Number(process.env.ZK_DEFAULT_AUTHORIZE_TIMEZONE_ID || 1);
const ZK_DEFAULT_AUTHORIZE_DOOR_ID = Number(process.env.ZK_DEFAULT_AUTHORIZE_DOOR_ID || 1);
const DEVICE_RECONCILE_COOLDOWN_MS = Number(process.env.DEVICE_RECONCILE_COOLDOWN_MS || 120000);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ZKTeco ADMS manda texto plano en distintos content-type según firmware.
// Algunas tablas de consulta devuelven payloads grandes, así que ampliamos el límite.
app.use(bodyParser.text({ type: "*/*", limit: "10mb" }));

const inflightByDevice = new Map();
const inflightByCommandId = new Map();
const recentQueryResults = [];
const reconcilePromiseByDevice = new Map();
const lastReconcileAtByDevice = new Map();

function setPlainText(res) {
  res.setHeader("Content-Type", "text/plain");
}

function nowTime() {
  return new Date().toLocaleTimeString();
}

function todayDateString() {
  return new Date().toISOString().split("T")[0];
}

function parsePushVersion(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoOrNull(value) {
  if (!value) return null;
  const normalized = String(value).replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function pickSn(req) {
  return req.query.SN || req.query.sn || "Unknown";
}

function parseKvPayload(raw) {
  const out = {};
  if (!raw || typeof raw !== "string") return out;

  raw
    .split(/[&\n]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((part) => {
      const idx = part.indexOf("=");
      if (idx === -1) return;
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      try {
        out[key] = decodeURIComponent(value);
      } catch {
        out[key] = value;
      }
    });

  return out;
}

function parseJsonBody(raw) {
  if (raw && typeof raw === "object") return raw;
  const text = String(raw || "").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseIntOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function sanitizeText(value, max = 255) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function sanitizeZkFieldValue(value, max = 64) {
  const cleaned = String(value || "")
    .replace(/[\t\r\n=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, max);
}

function normalizeZkUserName(fullName, biometricId) {
  return (
    (fullName || `USER${biometricId}`)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || `USER${biometricId}`
  );
}

function buildZkDataUserCommand(params) {
  const displayName = sanitizeZkFieldValue(params.fullName || `USER${params.biometricId}`, 24) || `USER${params.biometricId}`;
  return (
    `DATA UPDATE user ` +
    `CardNo=\t` +
    `Pin=${params.biometricId}\t` +
    `Password=\t` +
    `Group=${ZK_DEFAULT_USER_GROUP}\t` +
    `StartTime=0\t` +
    `EndTime=0\t` +
    `Name=${displayName}\t` +
    `Privilege=0`
  );
}

function buildZkUserQueryCommand(params) {
  return `DATA QUERY tablename=user,fielddesc=*,filter=Pin=${params.biometricId}`;
}

function buildZkUserAuthorizeCommand(params) {
  return (
    `DATA UPDATE userauthorize ` +
    `Pin=${params.biometricId}\t` +
    `AuthorizeTimezoneId=${ZK_DEFAULT_AUTHORIZE_TIMEZONE_ID}\t` +
    `AuthorizeDoorId=${ZK_DEFAULT_AUTHORIZE_DOOR_ID}`
  );
}

function buildZkUserDisableCommand(params) {
  return `DATA DELETE userauthorize Pin=${params.biometricId}`;
}

function buildZkUserDeleteCommands(params) {
  const commands = [buildZkUserDisableCommand(params)];

  for (let fingerId = 0; fingerId <= 9; fingerId += 1) {
    commands.push(`DATA DELETE templatev10 Pin=${params.biometricId}\tFingerID=${fingerId}`);
  }

  commands.push(`DATA DELETE user Pin=${params.biometricId}`);
  return commands;
}

function rememberQueryResult(entry) {
  recentQueryResults.unshift(entry);
  if (recentQueryResults.length > 200) {
    recentQueryResults.length = 200;
  }
}

function splitAttlogLine(rawLine) {
  if (rawLine.includes("\t")) {
    return rawLine.split("\t").map((t) => t.trim());
  }
  return rawLine
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseTabbedKvLine(rawLine) {
  return String(rawLine || "")
    .split("\t")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return acc;

      const key = part.slice(0, separatorIndex).trim().toLowerCase();
      const value = part.slice(separatorIndex + 1).trim();
      if (!key) return acc;

      acc[key] = value;
      return acc;
    }, {});
}

function parseAttlogLine(rawLine, sn) {
  const line = String(rawLine || "").trim();
  if (!line) return null;

  const tokens = splitAttlogLine(line);
  if (tokens.length < 2) return null;

  let offset = 0;
  if (tokens[0].toUpperCase() === "ATTLOG") {
    offset = 1;
  }

  const biometricId = parseIntOrNull(tokens[offset]);
  if (biometricId == null) return null;

  const firstTimestampToken = tokens[offset + 1] || "";
  const secondTimestampToken = tokens[offset + 2] || "";
  const hasCombinedTimestamp = /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(firstTimestampToken);
  const hasSplitTimestamp = /\d{4}-\d{2}-\d{2}/.test(firstTimestampToken) && /\d{2}:\d{2}:\d{2}/.test(secondTimestampToken);

  let punchTimeCandidate = "";
  let statusIndex = offset + 2;
  if (hasCombinedTimestamp) {
    punchTimeCandidate = firstTimestampToken;
    statusIndex = offset + 2;
  } else if (hasSplitTimestamp) {
    punchTimeCandidate = `${firstTimestampToken} ${secondTimestampToken}`;
    statusIndex = offset + 3;
  } else {
    return null;
  }

  const punchTime = toIsoOrNull(punchTimeCandidate);
  if (!punchTime) return null;

  const status1 = parseIntOrNull(tokens[statusIndex]);
  const status2 = parseIntOrNull(tokens[statusIndex + 1]);
  const status3 = parseIntOrNull(tokens[statusIndex + 2]);
  const status4 = parseIntOrNull(tokens[statusIndex + 3]);
  const status5 = parseIntOrNull(tokens[statusIndex + 4]);

  return {
    device_id: sanitizeText(sn, 80),
    biometric_id: biometricId,
    punch_time: punchTime,
    status1,
    status2,
    status3,
    status4,
    status5,
    raw_line: line,
    created_at: new Date().toISOString(),
  };
}

function parseAccessEventLine(rawLine, sn) {
  const line = String(rawLine || "").trim();
  if (!line || !line.includes("=")) return null;

  const fields = parseTabbedKvLine(line);
  const biometricId = parseIntOrNull(fields.pin);
  const punchTime = toIsoOrNull(fields.time);

  if (biometricId == null || !punchTime) return null;

  return {
    device_id: sanitizeText(sn, 80),
    biometric_id: biometricId,
    punch_time: punchTime,
    status1: parseIntOrNull(fields.event),
    status2: parseIntOrNull(fields.verifytype),
    status3: parseIntOrNull(fields.inoutstatus),
    status4: parseIntOrNull(fields.index),
    status5: parseIntOrNull(fields.eventaddr),
    raw_line: line,
    created_at: new Date().toISOString(),
  };
}

function isAuthorizedApiRequest(req) {
  if (!API_TOKEN) return true;
  const auth = String(req.headers.authorization || "");
  const fromHeader = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const fromQuery = String(req.query.token || "").trim();
  return fromHeader === API_TOKEN || fromQuery === API_TOKEN;
}

function parseQueryLimit(value, fallback = 200, min = 1, max = 1000) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function cleanupStaleInflight(sn) {
  const lock = inflightByDevice.get(sn);
  if (!lock) return;
  if (Date.now() - lock.sentAt <= COMMAND_LOCK_MS) return;

  inflightByDevice.delete(sn);
  inflightByCommandId.delete(lock.commandId);
  console.warn(`⚠️ [${nowTime()}] Lock expirado para SN=${sn}, cmd=${lock.commandId}`);
}

function normalizeCommandForDedupe(command) {
  return String(command || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSkipReasonForCommand(command) {
  const cmd = String(command || "")
    .toUpperCase()
    .trim();

  // En este H5L USERINFO devuelve -629.
  if (cmd.startsWith("DATA UPDATE USERINFO")) return "UNSUPPORTED_USERINFO_H5L";

  // En este H5L el payload largo sobre "user" puede crear usuarios corruptos
  // (nombre vacío / huella=1) aunque el comando responda OK.
  if (cmd.startsWith("DATA UPDATE USER UID=")) return "UNSUPPORTED_USER_LONG_PAYLOAD_H5L";

  // El formato corto "PIN/Name/Pri" también deja usuarios incompletos en este H5L.
  if (cmd.startsWith("DATA UPDATE USER PIN=")) return "UNSUPPORTED_USER_SHORT_PAYLOAD_H5L";

  // En este H5L ENROLL_USER remoto devuelve -708.
  // if (cmd.startsWith("ENROLL_USER")) return "UNSUPPORTED_ENROLL_REMOTE_H5L";

  return null;
}

async function resolveDeviceSyncProfile(params) {
  const customerId = sanitizeText(params.customerId, 80);
  const fullName = sanitizeText(params.fullName, 120);
  const biometricId = parseIntOrNull(params.biometricId);

  if (customerId && (biometricId == null || !fullName)) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("biometric_id, full_name")
      .eq("id", customerId)
      .single();

    if (error) {
      return { ok: false, status: 404, error: "profile_not_found", details: error.message };
    }

    const resolvedBiometricId = parseIntOrNull(profile?.biometric_id);
    const resolvedFullName = sanitizeText(profile?.full_name, 120);

    if (resolvedBiometricId == null) {
      return { ok: false, status: 400, error: "missing_biometric_id" };
    }

    return {
      ok: true,
      biometricId: resolvedBiometricId,
      fullName: resolvedFullName,
    };
  }

  if (biometricId == null) {
    return { ok: false, status: 400, error: "missing_biometric_id" };
  }

  return {
    ok: true,
    biometricId,
    fullName,
  };
}

async function queueUserRegistration(params) {
  const commandsToQueue = [
    {
      device_id: params.deviceId,
      command: buildZkDataUserCommand({
        biometricId: params.biometricId,
        fullName: params.fullName,
      }),
      executed: false,
    },
    {
      device_id: params.deviceId,
      command: buildZkUserAuthorizeCommand({
        biometricId: params.biometricId,
      }),
      executed: false,
    },
  ];

  const { error } = await supabase.from("device_commands").insert(commandsToQueue);
  if (error) {
    return { queued: false, error: error.message };
  }

  return {
    queued: true,
    commands: commandsToQueue.map((row) => row.command),
  };
}

async function queueDeviceCommands(params) {
  const commands = (params.commands || []).filter(Boolean);
  if (!params.deviceId || commands.length === 0) {
    return { queued: false, error: "missing_device_id_or_commands" };
  }

  const rows = commands.map((command) => ({
    device_id: params.deviceId,
    command,
    executed: false,
  }));

  const { error } = await supabase.from("device_commands").insert(rows);
  if (error) {
    return { queued: false, error: error.message };
  }

  return {
    queued: true,
    commands,
  };
}

async function queueUserDisable(params) {
  return queueDeviceCommands({
    deviceId: params.deviceId,
    commands: [buildZkUserDisableCommand({ biometricId: params.biometricId })],
  });
}

async function queueUserDeletion(params) {
  return queueDeviceCommands({
    deviceId: params.deviceId,
    commands: buildZkUserDeleteCommands({ biometricId: params.biometricId }),
  });
}

async function expirePastDueSubscriptions() {
  const today = todayDateString();

  const { data, error } = await supabase
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("end_date", today)
    .select("id, user_id, end_date");

  if (error) {
    console.error("❌ Error actualizando suscripciones vencidas:", error.message);
    return [];
  }

  return data || [];
}

async function loadProfilesForDeviceReconcile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, biometric_id, is_active")
    .eq("role", "client")
    .not("biometric_id", "is", null);

  if (error) {
    console.error("❌ Error consultando perfiles para reconciliación:", error.message);
    return [];
  }

  return data || [];
}

async function loadActiveSubscriptionUserIds() {
  const today = todayDateString();
  const { data, error } = await supabase.from("subscriptions").select("user_id, end_date").eq("status", "active");

  if (error) {
    console.error("❌ Error consultando suscripciones activas para reconciliación:", error.message);
    return new Set();
  }

  const activeUserIds = new Set();

  for (const subscription of data || []) {
    if (!subscription?.user_id) continue;
    if (!subscription.end_date || String(subscription.end_date) >= today) {
      activeUserIds.add(subscription.user_id);
    }
  }

  return activeUserIds;
}

async function loadPendingCommandSet(deviceId) {
  const { data, error } = await supabase
    .from("device_commands")
    .select("command")
    .eq("device_id", deviceId)
    .eq("executed", false)
    .limit(5000);

  if (error) {
    console.error(`❌ Error consultando comandos pendientes para reconciliación (${deviceId}):`, error.message);
    return new Set();
  }

  return new Set((data || []).map((row) => normalizeCommandForDedupe(row.command)));
}

function buildDesiredCommandsForProfile(profile, shouldEnable) {
  const biometricId = parseIntOrNull(profile?.biometric_id);
  if (biometricId == null || biometricId <= 0) return [];

  if (shouldEnable) {
    return [
      buildZkDataUserCommand({
        biometricId,
        fullName: profile?.full_name,
      }),
      buildZkUserAuthorizeCommand({
        biometricId,
      }),
    ];
  }

  return [
    buildZkUserDisableCommand({
      biometricId,
    }),
  ];
}

async function reconcileDeviceUsers(deviceId) {
  const sanitizedDeviceId = sanitizeText(deviceId, 80);
  if (!sanitizedDeviceId || sanitizedDeviceId === "Unknown") {
    return {
      success: false,
      queued_commands: 0,
      enabled_users: 0,
      disabled_users: 0,
      profiles_considered: 0,
      expired_subscriptions: 0,
      skipped: true,
      reason: "missing_device_id",
    };
  }

  const [expiredSubscriptions, profiles, activeSubscriptionUserIds, pendingCommandSet] = await Promise.all([
    expirePastDueSubscriptions(),
    loadProfilesForDeviceReconcile(),
    loadActiveSubscriptionUserIds(),
    loadPendingCommandSet(sanitizedDeviceId),
  ]);

  const rowsToInsert = [];
  let enabledUsers = 0;
  let disabledUsers = 0;

  for (const profile of profiles) {
    const shouldEnable = profile.is_active !== false && activeSubscriptionUserIds.has(profile.id);
    const commands = buildDesiredCommandsForProfile(profile, shouldEnable);

    if (commands.length === 0) {
      continue;
    }

    if (shouldEnable) {
      enabledUsers += 1;
    } else {
      disabledUsers += 1;
    }

    for (const command of commands) {
      const normalizedCommand = normalizeCommandForDedupe(command);
      if (pendingCommandSet.has(normalizedCommand)) {
        continue;
      }

      pendingCommandSet.add(normalizedCommand);
      rowsToInsert.push({
        device_id: sanitizedDeviceId,
        command,
        executed: false,
      });
    }
  }

  if (rowsToInsert.length > 0) {
    const { error } = await supabase.from("device_commands").insert(rowsToInsert);
    if (error) {
      throw new Error(error.message || "device_reconcile_insert_failed");
    }
  }

  return {
    success: true,
    queued_commands: rowsToInsert.length,
    enabled_users: enabledUsers,
    disabled_users: disabledUsers,
    profiles_considered: profiles.length,
    expired_subscriptions: expiredSubscriptions.length,
  };
}

function maybeReconcileDeviceUsers(deviceId, trigger) {
  const sanitizedDeviceId = sanitizeText(deviceId, 80);
  if (!sanitizedDeviceId || sanitizedDeviceId === "Unknown") {
    return null;
  }

  const existingPromise = reconcilePromiseByDevice.get(sanitizedDeviceId);
  if (existingPromise) {
    return existingPromise;
  }

  const lastReconcileAt = lastReconcileAtByDevice.get(sanitizedDeviceId) || 0;
  if (Date.now() - lastReconcileAt < DEVICE_RECONCILE_COOLDOWN_MS) {
    return null;
  }

  lastReconcileAtByDevice.set(sanitizedDeviceId, Date.now());

  const promise = reconcileDeviceUsers(sanitizedDeviceId)
    .then((result) => {
      console.log(
        `🔄 [${nowTime()}] Reconciliación ${trigger} SN=${sanitizedDeviceId} queued=${result.queued_commands} enabled=${result.enabled_users} disabled=${result.disabled_users} expired=${result.expired_subscriptions}`,
      );
      return result;
    })
    .catch((error) => {
      console.error(`❌ Error reconciliando usuarios del reloj SN=${sanitizedDeviceId} trigger=${trigger}:`, error);
      return {
        success: false,
        queued_commands: 0,
        enabled_users: 0,
        disabled_users: 0,
        profiles_considered: 0,
        expired_subscriptions: 0,
      };
    })
    .finally(() => {
      reconcilePromiseByDevice.delete(sanitizedDeviceId);
    });

  reconcilePromiseByDevice.set(sanitizedDeviceId, promise);
  return promise;
}

async function registerUserDirectOnClock(params) {
  const uid = parseIntOrNull(params.biometricId);
  const deviceIp = sanitizeText(params.deviceIp, 80);

  if (!deviceIp) {
    return { success: false, error: "missing_device_ip" };
  }

  if (uid == null || uid <= 0) {
    return { success: false, error: "invalid_biometric_id" };
  }

  // The selected SDK rejects larger UIDs; we fall back to ADMS queue in that case.
  if (uid > 3000) {
    return { success: false, error: "biometric_id_out_of_range_for_direct_sdk" };
  }

  const client = new ZKAttendanceClient(deviceIp, ZK_DEVICE_PORT, ZK_DEVICE_TIMEOUT, ZK_DEVICE_INPORT);

  try {
    await client.createSocket();

    const response = await client.setUser(
      uid,
      String(uid),
      normalizeZkUserName(params.fullName, uid),
      "",
      0,
      0,
    );

    if (response === false) {
      return { success: false, error: "sdk_rejected_user_payload" };
    }

    return {
      success: true,
      biometric_id: uid,
      device_ip: deviceIp,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "direct_sync_failed",
    };
  } finally {
    try {
      await client.disconnect();
    } catch {}
  }
}

app.use((req, _res, next) => {
  const sn = pickSn(req);
  if (!req.originalUrl.includes("ATTLOG") && !req.originalUrl.includes("cdata")) {
    console.log(`\n📨 [${nowTime()}] ${req.method} ${req.originalUrl} (SN: ${sn})`);
  }
  next();
});

// 1) Handshake / configuración
app.get("/iclock/cdata", (req, res) => {
  const sn = pickSn(req);
  const pushVersion = parsePushVersion(req.query.pushver);
  const isNewPushProtocol = pushVersion >= 2;

  void maybeReconcileDeviceUsers(sn, "cdata");

  setPlainText(res);

  const lines = [
    `GET OPTION FROM: ${sn}`,
    // Compatibilidad con firmwares viejos.
    `Stamp=0`,
    `OpStamp=0`,
    `PhotoStamp=0`,
    // Firmwares PushSDK >= 2.x esperan nombres explícitos por tabla.
    `ATTLOGStamp=0`,
    `OPERLOGStamp=0`,
    `ATTPHOTOStamp=0`,
    `ErrorDelay=30`,
    `Delay=10`,
    `TransTimes=00:00;23:59`,
    `TransInterval=1`,
    isNewPushProtocol
      ? `TransFlag=TransData AttLog\tOpLog\tAttPhoto`
      : `TransFlag=1111000000`,
    `Realtime=1`,
    `Encrypt=0`,
  ];

  if (isNewPushProtocol) {
    lines.push(`ServerVer=3.0.1`);
  }

  console.log(
    `⚙️ [${nowTime()}] GET OPTION SN=${sn} pushver=${String(req.query.pushver || "unknown")} protocol=${
      isNewPushProtocol ? "new" : "legacy"
    }`,
  );

  res.send(`${lines.join("\n")}\n`);
});

// 2) Registro ADMS
app.all("/iclock/registry", (req, res) => {
  const sn = pickSn(req);
  console.log(`📝 [${nowTime()}] INTENTO DE REGISTRO: ${sn}`);
  void maybeReconcileDeviceUsers(sn, "registry");

  // Compatibilidad entre firmwares
  res.setHeader("Set-Cookie", [`SessionID=${sn}; Path=/`, `PHPSESSID=${sn}; Path=/`]);
  setPlainText(res);
  res.send(`RegistryCode=${REGISTRY_CODE}\n`);
});

// 3) Polling de comandos
app.get("/iclock/getrequest", async (req, res) => {
  const sn = pickSn(req);
  setPlainText(res);

  try {
    void maybeReconcileDeviceUsers(sn, "getrequest");

    cleanupStaleInflight(sn);

    const lock = inflightByDevice.get(sn);
    if (lock) {
      return res.send("OK");
    }

    const { data: pendingRows, error } = await supabase
      .from("device_commands")
      .select("id, device_id, command, executed, created_at")
      .eq("device_id", sn)
      .eq("executed", false)
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) {
      console.error(`❌ Error consultando cola de comandos (${sn}):`, error.message);
      return res.send("OK");
    }

    if (!pendingRows || pendingRows.length === 0) {
      return res.send("OK");
    }

    let data = null;
    const skipped = [];
    const seen = new Set();

    for (const row of pendingRows) {
      const skipReason = getSkipReasonForCommand(row.command);
      if (skipReason) {
        skipped.push({ id: row.id, reason: skipReason });
        continue;
      }

      const key = normalizeCommandForDedupe(row.command);
      if (seen.has(key)) {
        skipped.push({ id: row.id, reason: "SKIPPED_DUPLICATE" });
        continue;
      }
      seen.add(key);

      if (!data) {
        data = row;
      } else {
        // Solo enviamos un comando por poll; el resto únicos quedan para siguientes polls.
        // No los marcamos como duplicados aquí para no perder trabajo válido.
        break;
      }
    }

    if (skipped.length > 0) {
      for (const row of skipped) {
        const { error: skipError } = await supabase
          .from("device_commands")
          .update({ executed: true, return_code: row.reason })
          .eq("id", row.id);
        if (skipError) {
          console.warn(`⚠️ Error marcando omitido id=${row.id} (${sn}):`, skipError.message);
        }
      }
      console.log(
        `🧹 [${nowTime()}] Omitidos en cola SN=${sn}: ${skipped.map((r) => `${r.id}:${r.reason}`).join(", ")}`,
      );
    }

    if (!data) {
      return res.send("OK");
    }

    inflightByDevice.set(sn, { commandId: data.id, sentAt: Date.now() });
    inflightByCommandId.set(data.id, sn);

    console.log(`🚀 [${nowTime()}] ENVIANDO COMANDO id=${data.id} -> ${data.command}`);
    return res.send(`C:${data.id}:${data.command}`);
  } catch (error) {
    console.error("❌ Exception en /iclock/getrequest:", error);
    return res.send("OK");
  }
});

// 4) Confirmación de ejecución de comando
app.post("/iclock/devicecmd", async (req, res) => {
  setPlainText(res);

  try {
    const sn = pickSn(req);
    const bodyKv = parseKvPayload(req.body);

    const rawId = req.query.ID || req.query.id || bodyKv.ID || bodyKv.id;
    const rawReturn = req.query.Return || req.query.RETURN || bodyKv.Return || bodyKv.RETURN;

    const commandId = Number(String(rawId || "").match(/\d+/)?.[0]);
    const returnCode = rawReturn != null ? String(rawReturn).trim() : "";

    console.log(`🧐 [${nowTime()}] devicecmd SN=${sn} ID=${rawId} Return=${returnCode} body='${req.body || ""}'`);

    if (!Number.isFinite(commandId)) {
      return res.send("OK");
    }

    const { error } = await supabase
      .from("device_commands")
      .update({ executed: true, return_code: returnCode })
      .eq("id", commandId);
    if (error) {
      console.error(`❌ No se pudo marcar ejecutado id=${commandId}:`, error.message);
    } else if (!returnCode || SUCCESS_RETURNS.has(returnCode)) {
      console.log(`✅ [${nowTime()}] Comando confirmado id=${commandId} Return=${returnCode || "0"}`);
    } else {
      console.warn(`⚠️ [${nowTime()}] Comando ejecutado con error id=${commandId} Return=${returnCode}`);
    }

    const lockedSn = inflightByCommandId.get(commandId);
    if (lockedSn) {
      inflightByDevice.delete(lockedSn);
      inflightByCommandId.delete(commandId);
    }

    return res.send("OK");
  } catch (error) {
    console.error("❌ Exception en /iclock/devicecmd:", error);
    return res.send("OK");
  }
});

// 5) Recepción de eventos/ATTLOG
app.post("/iclock/cdata", async (req, res) => {
  setPlainText(res);

  try {
    const sn = pickSn(req);
    const payload = String(req.body || "").trim();

    if (!payload) return res.send("OK");

    // Log the full payload so we can inspect the EXACT table structure device uses natively
    console.log(`\n\n=== RAW CDATA PUSH (SN: ${sn}) ===\n${payload}\n=================================\n`);

    const lines = payload
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const attlogLines = lines.filter((line) => line.includes("ATTLOG") || /^\d+\s+\d{4}-\d{2}-\d{2}/.test(line));
    const accessEventLines = lines.filter(
      (line) => !attlogLines.includes(line) && line.toLowerCase().includes("time=") && line.toLowerCase().includes("pin="),
    );

    if (attlogLines.length > 0) {
      console.log(`📥 [${nowTime()}] ATTLOG recibido SN=${sn} registros=${attlogLines.length}`);

      if (ATTLOG_TABLE) {
        const rows = attlogLines.map((raw_line) => ({
          device_id: sn,
          raw_line,
          received_at: new Date().toISOString(),
        }));

        const { error } = await supabase.from(ATTLOG_TABLE).insert(rows);
        if (error) {
          console.error(`❌ Error insertando ATTLOG en '${ATTLOG_TABLE}':`, error.message);
        }
      }

      const parsedRows = attlogLines.map((line) => parseAttlogLine(line, sn)).filter(Boolean);
      if (parsedRows.length > 0) {
        const upsertPayload = parsedRows.map((row) => ({
          device_id: row.device_id,
          biometric_id: row.biometric_id,
          punch_time: row.punch_time,
          status1: row.status1,
          status2: row.status2,
          status3: row.status3,
          status4: row.status4,
          status5: row.status5,
          raw_line: row.raw_line,
          created_at: row.created_at,
        }));

        const { error: upsertError } = await supabase
          .from(ATTENDANCE_TABLE)
          .upsert(upsertPayload, { onConflict: "device_id,biometric_id,punch_time,status1,status2" });

        if (upsertError) {
          const { error: insertError } = await supabase.from(ATTENDANCE_TABLE).insert(upsertPayload);
          if (insertError) {
            console.error(`❌ Error guardando ATTLOG parseado en '${ATTENDANCE_TABLE}':`, insertError.message);
          }
        }
      }
    }

    if (accessEventLines.length > 0) {
      console.log(`📥 [${nowTime()}] ACCESS EVENT recibido SN=${sn} registros=${accessEventLines.length}`);

      const parsedRows = accessEventLines.map((line) => parseAccessEventLine(line, sn)).filter(Boolean);
      if (parsedRows.length > 0) {
        const upsertPayload = parsedRows.map((row) => ({
          device_id: row.device_id,
          biometric_id: row.biometric_id,
          punch_time: row.punch_time,
          status1: row.status1,
          status2: row.status2,
          status3: row.status3,
          status4: row.status4,
          status5: row.status5,
          raw_line: row.raw_line,
          created_at: row.created_at,
        }));

        const { error: upsertError } = await supabase
          .from(ATTENDANCE_TABLE)
          .upsert(upsertPayload, { onConflict: "device_id,biometric_id,punch_time,status1,status2" });

        if (upsertError) {
          const { error: insertError } = await supabase.from(ATTENDANCE_TABLE).insert(upsertPayload);
          if (insertError) {
            console.error(`❌ Error guardando ACCESS EVENT en '${ATTENDANCE_TABLE}':`, insertError.message);
          }
        }
      }
    }

    return res.send("OK");
  } catch (error) {
    console.error("❌ Exception en /iclock/cdata:", error);
    return res.send("OK");
  }
});

app.post("/iclock/querydata", async (req, res) => {
  setPlainText(res);

  try {
    const sn = pickSn(req);
    const payload = String(req.body || "").trim();
    const queryResult = {
      device_id: sanitizeText(sn, 80),
      type: sanitizeText(req.query.type, 40),
      table_name: sanitizeText(req.query.tablename, 80),
      command_id: parseIntOrNull(req.query.cmdid),
      count: parseIntOrNull(req.query.count),
      pack_count: parseIntOrNull(req.query.packcnt),
      pack_index: parseIntOrNull(req.query.packidx),
      body: payload,
      created_at: new Date().toISOString(),
    };

    rememberQueryResult(queryResult);

    console.log(
      `\n\n=== RAW QUERYDATA PUSH (SN: ${sn}, table=${queryResult.table_name || "?"}, cmd=${queryResult.command_id ?? "?"}) ===\n${payload}\n=================================\n`,
    );

    return res.send("OK");
  } catch (error) {
    console.error("❌ Exception en /iclock/querydata:", error);
    return res.send("OK");
  }
});

app.get("/api/attendance", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (!isAuthorizedApiRequest(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const limit = parseQueryLimit(req.query.limit, 200, 1, 1000);
    const dateFrom = sanitizeText(req.query.date_from, 25);
    const dateTo = sanitizeText(req.query.date_to, 25);
    const deviceId = sanitizeText(req.query.device_id, 80);
    const biometricId = parseIntOrNull(req.query.biometric_id);

    let query = supabase
      .from(ATTENDANCE_TABLE)
      .select("device_id,biometric_id,punch_time,status1,status2,status3,status4,status5,raw_line,created_at")
      .order("punch_time", { ascending: false })
      .limit(limit);

    if (deviceId) query = query.eq("device_id", deviceId);
    if (biometricId != null) query = query.eq("biometric_id", biometricId);
    if (dateFrom) query = query.gte("punch_time", dateFrom);
    if (dateTo) query = query.lte("punch_time", dateTo);

    const { data, error } = await query;
    if (error) {
      console.error("❌ Error consultando asistencia:", error.message);
      return res.status(500).json({ error: "attendance_query_failed", details: error.message });
    }

    return res.json({ data: data || [] });
  } catch (error) {
    console.error("❌ Exception en /api/attendance:", error);
    return res.status(500).json({ error: "attendance_exception" });
  }
});

app.get("/api/device-commands", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (!isAuthorizedApiRequest(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const limit = parseQueryLimit(req.query.limit, 100, 1, 500);
    const deviceId = sanitizeText(req.query.device_id, 80);
    const executedRaw = sanitizeText(req.query.executed, 10);

    let query = supabase
      .from("device_commands")
      .select("id,device_id,command,executed,return_code,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (deviceId) query = query.eq("device_id", deviceId);
    if (executedRaw === "true") query = query.eq("executed", true);
    if (executedRaw === "false") query = query.eq("executed", false);

    const { data, error } = await query;
    if (error) {
      console.error("❌ Error consultando device_commands:", error.message);
      return res.status(500).json({ error: "device_commands_query_failed", details: error.message });
    }

    return res.json({ data: data || [] });
  } catch (error) {
    console.error("❌ Exception en /api/device-commands:", error);
    return res.status(500).json({ error: "device_commands_exception" });
  }
});

app.get("/api/device-query-results", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (!isAuthorizedApiRequest(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const limit = parseQueryLimit(req.query.limit, 20, 1, 200);
    const deviceId = sanitizeText(req.query.device_id, 80);
    const biometricId = parseIntOrNull(req.query.biometric_id);

    let rows = recentQueryResults.slice();

    if (deviceId) {
      rows = rows.filter((row) => row.device_id === deviceId);
    }

    if (biometricId != null) {
      rows = rows.filter((row) => String(row.body || "").toLowerCase().includes(`pin=${String(biometricId).toLowerCase()}`));
    }

    return res.json({ data: rows.slice(0, limit) });
  } catch (error) {
    console.error("❌ Exception en /api/device-query-results:", error);
    return res.status(500).json({ error: "device_query_results_exception" });
  }
});

app.post("/api/device-users/register", async (req, res) => {
  if (!isAuthorizedApiRequest(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const payload = parseJsonBody(req.body);
    if (payload == null) {
      return res.status(400).json({ error: "invalid_json" });
    }

    const resolved = await resolveDeviceSyncProfile({
      customerId: payload.customer_id,
      biometricId: payload.biometric_id,
      fullName: payload.full_name,
    });

    if (!resolved.ok) {
      return res.status(resolved.status).json({
        success: false,
        synced: false,
        method: "none",
        error: resolved.error,
        details: resolved.details,
      });
    }

    const deviceId = sanitizeText(payload.device_id, 80);
    const deviceIp = sanitizeText(payload.device_ip, 80) || ZK_DEVICE_IP;

    let direct = null;
    if (deviceIp) {
      direct = await registerUserDirectOnClock({
        deviceIp,
        biometricId: resolved.biometricId,
        fullName: resolved.fullName,
      });

      if (direct.success) {
        return res.json({
          success: true,
          synced: true,
          queued: true,
          method: "direct",
          biometric_id: resolved.biometricId,
          device_id: deviceId || null,
          direct,
        });
      }
    }

    if (!deviceId) {
      return res.status(503).json({
        success: false,
        synced: false,
        method: "none",
        error: direct?.error || "missing_device_id_for_queue_fallback",
        direct,
      });
    }

    const queued = await queueUserRegistration({
      deviceId,
      biometricId: resolved.biometricId,
      fullName: resolved.fullName,
    });

    if (!queued.queued) {
      return res.status(500).json({
        success: false,
        synced: false,
        method: "none",
        error: queued.error || "queue_failed",
        direct,
      });
    }

    return res.json({
      success: true,
      synced: true,
      queued: true,
      method: "queue",
      biometric_id: resolved.biometricId,
      device_id: deviceId,
      direct,
      queue: queued,
    });
  } catch (error) {
    console.error("❌ Exception en /api/device-users/register:", error);
    return res.status(500).json({ success: false, synced: false, method: "none", error: "device_user_register_exception" });
  }
});

app.post("/api/device-users/query", async (req, res) => {
  if (!isAuthorizedApiRequest(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const payload = parseJsonBody(req.body);
    if (payload == null) {
      return res.status(400).json({ error: "invalid_json" });
    }

    const resolved = await resolveDeviceSyncProfile({
      customerId: payload.customer_id,
      biometricId: payload.biometric_id,
      fullName: payload.full_name,
    });

    if (!resolved.ok) {
      return res.status(resolved.status).json({
        success: false,
        queued: false,
        error: resolved.error,
        details: resolved.details,
      });
    }

    const deviceId = sanitizeText(payload.device_id, 80);
    if (!deviceId) {
      return res.status(400).json({ success: false, queued: false, error: "missing_device_id" });
    }

    const command = buildZkUserQueryCommand({
      biometricId: resolved.biometricId,
    });

    const { error } = await supabase.from("device_commands").insert([
      {
        device_id: deviceId,
        command,
        executed: false,
      },
    ]);

    if (error) {
      return res.status(500).json({ success: false, queued: false, error: error.message });
    }

    return res.json({
      success: true,
      queued: true,
      biometric_id: resolved.biometricId,
      device_id: deviceId,
      command,
    });
  } catch (error) {
    console.error("❌ Exception en /api/device-users/query:", error);
    return res.status(500).json({ success: false, queued: false, error: "device_user_query_exception" });
  }
});

app.post("/api/device-users/disable", async (req, res) => {
  if (!isAuthorizedApiRequest(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const payload = parseJsonBody(req.body);
    if (payload == null) {
      return res.status(400).json({ error: "invalid_json" });
    }

    const resolved = await resolveDeviceSyncProfile({
      customerId: payload.customer_id,
      biometricId: payload.biometric_id,
      fullName: payload.full_name,
    });

    if (!resolved.ok) {
      return res.status(resolved.status).json({
        success: false,
        queued: false,
        error: resolved.error,
        details: resolved.details,
      });
    }

    const deviceId = sanitizeText(payload.device_id, 80);
    if (!deviceId) {
      return res.status(400).json({ success: false, queued: false, error: "missing_device_id" });
    }

    const queued = await queueUserDisable({
      deviceId,
      biometricId: resolved.biometricId,
    });

    if (!queued.queued) {
      return res.status(500).json({ success: false, queued: false, error: queued.error || "queue_failed" });
    }

    return res.json({
      success: true,
      queued: true,
      biometric_id: resolved.biometricId,
      device_id: deviceId,
      commands: queued.commands,
    });
  } catch (error) {
    console.error("❌ Exception en /api/device-users/disable:", error);
    return res.status(500).json({ success: false, queued: false, error: "device_user_disable_exception" });
  }
});

app.post("/api/device-users/delete", async (req, res) => {
  if (!isAuthorizedApiRequest(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const payload = parseJsonBody(req.body);
    if (payload == null) {
      return res.status(400).json({ error: "invalid_json" });
    }

    const resolved = await resolveDeviceSyncProfile({
      customerId: payload.customer_id,
      biometricId: payload.biometric_id,
      fullName: payload.full_name,
    });

    if (!resolved.ok) {
      return res.status(resolved.status).json({
        success: false,
        queued: false,
        error: resolved.error,
        details: resolved.details,
      });
    }

    const deviceId = sanitizeText(payload.device_id, 80);
    if (!deviceId) {
      return res.status(400).json({ success: false, queued: false, error: "missing_device_id" });
    }

    const queued = await queueUserDeletion({
      deviceId,
      biometricId: resolved.biometricId,
    });

    if (!queued.queued) {
      return res.status(500).json({ success: false, queued: false, error: queued.error || "queue_failed" });
    }

    return res.json({
      success: true,
      queued: true,
      biometric_id: resolved.biometricId,
      device_id: deviceId,
      commands: queued.commands,
    });
  } catch (error) {
    console.error("❌ Exception en /api/device-users/delete:", error);
    return res.status(500).json({ success: false, queued: false, error: "device_user_delete_exception" });
  }
});

app.post("/api/device-users/reconcile", async (req, res) => {
  if (!isAuthorizedApiRequest(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const payload = parseJsonBody(req.body);
    if (payload == null) {
      return res.status(400).json({ error: "invalid_json" });
    }

    const deviceId = sanitizeText(payload.device_id, 80);
    if (!deviceId) {
      return res.status(400).json({ success: false, error: "missing_device_id" });
    }

    const result = await reconcileDeviceUsers(deviceId);
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("❌ Exception en /api/device-users/reconcile:", error);
    return res.status(500).json({ success: false, error: "device_user_reconcile_exception" });
  }
});

app.get("/health", (_req, res) => {
  setPlainText(res);
  res.send("OK");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SERVIDOR LISTO EN PUERTO ${PORT}`);
});
