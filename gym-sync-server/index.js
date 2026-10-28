require("dotenv").config();
const { timingSafeEqual } = require("node:crypto");
const express = require("express");
const bodyParser = require("body-parser");
const { createLocalDbFromEnvironment } = require("./local-db");
const { isLocalClockAddress } = require("./local-clock-address");
const { createAttendanceParsers } = require("./attendance-parser");
const { createClockUserInventory } = require("./clock-user-inventory");
const { parseCommandConfirmations } = require("./command-confirmations");
const ZKAttendanceClient = require("zk-attendance-sdk");

const app = express();
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.SYNC_HOST || "0.0.0.0";
const REGISTRY_CODE = String(process.env.ZK_REGISTRY_CODE || "1");
const COMMAND_LOCK_MS = Number(process.env.COMMAND_LOCK_MS || 25000);
const COMMAND_BATCH_SIZE = Math.max(1, Math.min(20, Number(process.env.ZK_COMMAND_BATCH_SIZE || 1) || 1));
const SUCCESS_RETURNS = new Set(
  String(process.env.ZK_SUCCESS_RETURNS || "0")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
);
const API_TOKEN = process.env.SYNC_API_TOKEN || "";
const ZK_TIME_UTC_OFFSET = process.env.ZK_TIME_UTC_OFFSET || "-06:00";
const ZK_DEVICE_IP = String(process.env.ZK_DEVICE_IP || "").trim();
const ZK_DEVICE_SERIAL = String(process.env.ZK_DEVICE_SERIAL || "").trim();
const ZK_DEVICE_PORT = Number(process.env.ZK_DEVICE_PORT || 4370);
const ZK_DEVICE_TIMEOUT = Number(process.env.ZK_DEVICE_TIMEOUT || 5000);
const ZK_DEVICE_INPORT = Number(process.env.ZK_DEVICE_INPORT || 5200);
const ZK_DEFAULT_USER_GROUP = Number(process.env.ZK_DEFAULT_USER_GROUP || 1);
const ZK_DEFAULT_AUTHORIZE_TIMEZONE_ID = Number(process.env.ZK_DEFAULT_AUTHORIZE_TIMEZONE_ID || 1);
const ZK_DEFAULT_AUTHORIZE_DOOR_ID = Number(process.env.ZK_DEFAULT_AUTHORIZE_DOOR_ID || 1);
const DEVICE_RECONCILE_COOLDOWN_MS = Number(process.env.DEVICE_RECONCILE_COOLDOWN_MS || 120000);
const COMMAND_DELIVERY_PAUSED_SETTING = process.env.SYNC_COMMAND_DELIVERY_PAUSED || "true";

const db = createLocalDbFromEnvironment();
const clockInventory = createClockUserInventory({ ip: ZK_DEVICE_IP, port: ZK_DEVICE_PORT, serial: ZK_DEVICE_SERIAL });
const getKnownUserPins = (deviceId) => clockInventory.getKnownUserPins(deviceId);

if (!API_TOKEN || API_TOKEN === "TU_SYNC_API_TOKEN") {
  throw new Error("SYNC_API_TOKEN debe configurarse para las rutas administrativas del sync");
}
if (!/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(ZK_TIME_UTC_OFFSET)) {
  throw new Error("ZK_TIME_UTC_OFFSET debe tener formato ±HH:MM");
}
if (ZK_DEVICE_IP && !isLocalClockAddress(ZK_DEVICE_IP)) {
  throw new Error("ZK_DEVICE_IP debe ser una IPv4 local del reloj");
}
if (!new Set(["true", "false"]).has(COMMAND_DELIVERY_PAUSED_SETTING)) {
  throw new Error("SYNC_COMMAND_DELIVERY_PAUSED debe ser true o false");
}

function isCommandDeliveryPaused() {
  return (process.env.SYNC_COMMAND_DELIVERY_PAUSED || "true") === "true";
}

// ZKTeco ADMS manda texto plano en distintos content-type según firmware.
// Algunas tablas de consulta devuelven payloads grandes, así que ampliamos el límite.
app.use(bodyParser.text({ type: "*/*", limit: "10mb" }));

const inflightByDevice = new Map();
const inflightByCommandId = new Map();
const recentQueryResults = [];
const reconcilePromiseByDevice = new Map();
const lastReconcileAtByDevice = new Map();
const reconcileQueueByDevice = new Map();

function setPlainText(res) {
  res.setHeader("Content-Type", "text/plain");
}

function nowTime() {
  return new Date().toLocaleTimeString();
}

function parsePushVersion(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const raw = String(value).trim();
  if (!/^-?\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= -2147483648 && n <= 2147483647 ? n : null;
}

function parsePositiveBiometricIdOrNull(value) {
  const biometricId = parseIntOrNull(value);
  return biometricId != null && biometricId > 0 ? biometricId : null;
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

const { parseAttlogLine, parseAccessEventLine, parseNonPersonAccessEvent, isAccessEventLine, describeInvalidAccessBatch } =
  createAttendanceParsers(ZK_TIME_UTC_OFFSET);

function isAuthorizedApiRequest(req) {
  const auth = String(req.headers.authorization || "");
  const fromHeader = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const expected = Buffer.from(API_TOKEN);
  const actual = Buffer.from(fromHeader);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
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
  for (const id of lock.commandIds || [lock.commandId]) inflightByCommandId.delete(id);
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
  const biometricId = parsePositiveBiometricIdOrNull(params.biometricId);

  if (customerId && (biometricId == null || !fullName)) {
    let profile;
    try {
      profile = await db.findProfile(customerId);
    } catch (error) {
      return { ok: false, status: 500, error: "profile_query_failed", details: error.message };
    }
    if (!profile) {
      return { ok: false, status: 404, error: "profile_not_found" };
    }

    const resolvedBiometricId = parsePositiveBiometricIdOrNull(profile?.biometric_id);
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

  try {
    await db.insertCommands(commandsToQueue);
  } catch (error) {
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

  try {
    await db.insertCommands(rows);
  } catch (error) {
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
  try {
    return await db.expirePastDueSubscriptions();
  } catch (error) {
    console.error("❌ Error actualizando suscripciones vencidas:", error.message);
    throw error;
  }
}

async function loadProfilesForDeviceReconcile() {
  try {
    return await db.loadProfilesForReconcile();
  } catch (error) {
    console.error("❌ Error consultando perfiles para reconciliación:", error.message);
    throw error;
  }
}

async function loadActiveSubscriptionUserIds() {
  try {
    return await db.loadActiveSubscriptionUserIds();
  } catch (error) {
    console.error("❌ Error consultando suscripciones activas para reconciliación:", error.message);
    throw error;
  }
}

const { planDeviceReconciliation } = require("./reconcile-plan");

function buildDesiredCommandsForProfile(profile, shouldEnable, knownUserPins = null) {
  const biometricId = parseIntOrNull(profile?.biometric_id);
  if (biometricId == null || biometricId <= 0) return [];

  if (shouldEnable) {
    return [
      ...(!knownUserPins?.has(biometricId) ? [buildZkDataUserCommand({
        biometricId,
        fullName: profile?.full_name,
      })] : []),
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

function reconcileDeviceUsers(deviceId, profileId = null, profileType = null, options = {}) {
  const key = String(deviceId || "").trim();
  const previous = reconcileQueueByDevice.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(() => reconcileDeviceUsersUnlocked(deviceId, profileId, profileType, options));
  reconcileQueueByDevice.set(key, next);
  void next.finally(() => {
    if (reconcileQueueByDevice.get(key) === next) reconcileQueueByDevice.delete(key);
  }).catch(() => {});
  return next;
}

async function reconcileDeviceUsersUnlocked(deviceId, profileId = null, profileType = null, options = {}) {
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

  const [expiredSubscriptions, allProfiles, activeSubscriptionUserIds] = await Promise.all([
    expirePastDueSubscriptions(),
    loadProfilesForDeviceReconcile(),
    loadActiveSubscriptionUserIds(),
  ]);
  const profiles = profileId
    ? allProfiles.filter((profile) => profile.id === profileId &&
      (profileType === "client" ? profile.role === "client" : profile.role !== "client"))
    : allProfiles;

  if (profileId && profiles.length === 0) {
    return { success: false, reason: "profile_not_found" };
  }

  const desiredStates = [];
  const observedPins = options.knownUserPins ?? await getKnownUserPins(sanitizedDeviceId);
  const knownUserPins = observedPins == null ? null : new Set([...observedPins].map(Number));
  let enabledUsers = 0;
  let disabledUsers = 0;

  for (const profile of profiles) {
    const shouldEnable = profile.is_active !== false &&
      (profile.role !== "client" || activeSubscriptionUserIds.has(profile.id));
    const commands = buildDesiredCommandsForProfile(profile, shouldEnable, knownUserPins);

    if (commands.length === 0) {
      continue;
    }

    if (shouldEnable) {
      enabledUsers += 1;
    } else {
      disabledUsers += 1;
    }

    desiredStates.push({
      pin: Number(profile.biometric_id),
      commands,
      // A live inventory reporting absence is stronger evidence than an old ACK.
      invalidateConfirmedFamilies: knownUserPins && !knownUserPins.has(Number(profile.biometric_id)) ? ["profile"] : [],
    });
  }

  const result = await db.reconcileCommandState(sanitizedDeviceId, desiredStates.map((state) => state.pin),
    (history) => {
      return planDeviceReconciliation({
        desiredStates,
        history,
        successReturns: SUCCESS_RETURNS,
        protectedCommandIds: [...inflightByCommandId.entries()]
          .filter(([, serial]) => serial === sanitizedDeviceId).map(([id]) => id),
      });
    });

  return {
    success: true,
    ...result,
    enabled_users: enabledUsers,
    disabled_users: disabledUsers,
    profiles_considered: profiles.length,
    expired_subscriptions: expiredSubscriptions.length,
  };
}

function maybeReconcileDeviceUsers(deviceId, trigger) {
  if (isCommandDeliveryPaused()) return null;
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
  if (isCommandDeliveryPaused()) {
    return { success: false, error: "command_delivery_paused" };
  }
  const uid = parseIntOrNull(params.biometricId);
  const deviceIp = sanitizeText(params.deviceIp, 80);

  if (!deviceIp) {
    return { success: false, error: "missing_device_ip" };
  }
  if (!isLocalClockAddress(deviceIp)) {
    return { success: false, error: "non_local_device_ip" };
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
  if (!req.path.includes("cdata")) {
    console.log(`\n📨 [${nowTime()}] ${req.method} ${req.path} (SN: ${sn})`);
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
app.all("/iclock/ping", (_req, res) => {
  setPlainText(res);
  res.send("OK");
});

app.get("/iclock/getrequest", async (req, res) => {
  const sn = pickSn(req);
  setPlainText(res);

  try {
    if (isCommandDeliveryPaused()) {
      return res.send("OK");
    }
    if (ZK_DEVICE_SERIAL && sn !== ZK_DEVICE_SERIAL) return res.status(400).send("ERROR");
    await maybeReconcileDeviceUsers(sn, "getrequest");

    cleanupStaleInflight(sn);

    const lock = inflightByDevice.get(sn);
    if (lock) {
      return res.send("OK");
    }

    const pendingRows = await db.listPendingCommands(sn);

    if (!pendingRows || pendingRows.length === 0) {
      return res.send("OK");
    }

    const selected = [];
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

      selected.push(row);
      if (selected.length >= COMMAND_BATCH_SIZE) break;
    }

    if (skipped.length > 0) {
      for (const row of skipped) {
        try {
          await db.markCommandExecuted(row.id, row.reason, sn);
        } catch (error) {
          console.warn(`⚠️ Error marcando omitido id=${row.id} (${sn}):`, error.message);
        }
      }
      console.log(
        `🧹 [${nowTime()}] Omitidos en cola SN=${sn}: ${skipped.map((r) => `${r.id}:${r.reason}`).join(", ")}`,
      );
    }

    if (selected.length === 0) {
      return res.send("OK");
    }

    inflightByDevice.set(sn, { commandId: selected[0].id, commandIds: new Set(selected.map((row) => row.id)), sentAt: Date.now() });
    for (const row of selected) {
      inflightByCommandId.set(row.id, sn);
      console.log(`🚀 [${nowTime()}] ENVIANDO COMANDO id=${row.id} SN=${sn}`);
    }
    return res.send(selected.map((row) => `C:${row.id}:${row.command}`).join("\n") + "\n");
  } catch (error) {
    console.error("❌ Exception en /iclock/getrequest:", error);
    return res.status(503).send("ERROR");
  }
});

// 4) Confirmación de ejecución de comando
app.post("/iclock/devicecmd", async (req, res) => {
  setPlainText(res);

  try {
    const sn = pickSn(req);
    if (ZK_DEVICE_SERIAL && sn !== ZK_DEVICE_SERIAL) return res.status(400).send("ERROR");
    const confirmations = parseCommandConfirmations(req.body, req.query);
    for (const { id: commandId, returnCode } of confirmations) {
      console.log(`🧐 [${nowTime()}] devicecmd SN=${sn} ID=${commandId} Return=${returnCode}`);
      const updated = await db.markCommandExecuted(commandId, returnCode, sn);
      if (!updated) {
        console.warn(`⚠️ Confirmación sin comando pendiente id=${commandId} SN=${sn}`);
    } else if (SUCCESS_RETURNS.has(returnCode)) {
        console.log(`✅ [${nowTime()}] Comando confirmado id=${commandId} Return=${returnCode}`);
        clockInventory.invalidate();
      } else {
        console.warn(`⚠️ [${nowTime()}] Comando ejecutado con error id=${commandId} Return=${returnCode}`);
      }
      const lockedSn = inflightByCommandId.get(commandId);
      if (updated && lockedSn === sn) {
        const lock = inflightByDevice.get(sn);
        if (lock?.commandIds) {
          lock.commandIds.delete(commandId);
          if (lock.commandIds.size === 0) inflightByDevice.delete(sn);
        } else inflightByDevice.delete(sn);
        inflightByCommandId.delete(commandId);
      }
    }

    return res.send("OK");
  } catch (error) {
    console.error("❌ Exception en /iclock/devicecmd:", error);
    return res.status(503).send("ERROR");
  }
});

// 5) Recepción de eventos/ATTLOG
app.post("/iclock/cdata", async (req, res) => {
  setPlainText(res);

  try {
    const sn = pickSn(req);
    const payload = String(req.body || "").trim();

    if (!payload) return res.send("OK");
    if (typeof sn !== "string" || sn === "Unknown" || !sanitizeText(sn, 80)) {
      return res.status(400).send("ERROR");
    }

    const lines = payload
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const attlogLines = lines.filter((line) => line.includes("ATTLOG") || /^\d+\s+\d{4}-\d{2}-\d{2}/.test(line));
    const accessEventLines = lines.filter(
      (line) => !attlogLines.includes(line) && isAccessEventLine(line),
    );

    if (attlogLines.length > 0) {
      console.log(`📥 [${nowTime()}] ATTLOG recibido SN=${sn} registros=${attlogLines.length}`);

      const parsedRows = attlogLines.map((line) => parseAttlogLine(line, sn));
      if (parsedRows.some((row) => !row)) {
        console.error(`❌ ATTLOG inválido SN=${sn}; el reloj debe reintentar el lote`);
        return res.status(503).send("ERROR");
      }
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

        await db.insertAttendance(upsertPayload);
      }
    }

    if (accessEventLines.length > 0) {
      console.log(`📥 [${nowTime()}] ACCESS EVENT recibido SN=${sn} registros=${accessEventLines.length}`);

      const classifiedRows = accessEventLines.map((line) => ({
        attendance: parseAccessEventLine(line, sn),
        deviceEvent: parseNonPersonAccessEvent(line, sn),
      }));
      if (classifiedRows.some((row) => !row.attendance && !row.deviceEvent)) {
        console.error(`❌ ACCESS EVENT inválido SN=${sn}; el reloj debe reintentar el lote`);
        console.error("ACCESS_EVENT_DIAGNOSTIC", JSON.stringify(describeInvalidAccessBatch(accessEventLines)));
        return res.status(503).send("ERROR");
      }
      const parsedRows = classifiedRows.map((row) => row.attendance).filter(Boolean);
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

        await db.insertAttendance(upsertPayload);
      }
      for (const { deviceEvent } of classifiedRows) {
        if (deviceEvent) console.info("DEVICE_EVENT_NO_PERSON", JSON.stringify(deviceEvent));
      }
    }

    return res.send("OK");
  } catch (error) {
    console.error("❌ Exception en /iclock/cdata:", error);
    return res.status(503).send("ERROR");
  }
});

app.post("/iclock/querydata", async (req, res) => {
  setPlainText(res);

  try {
    const sn = pickSn(req);
    const rawPayload = String(req.body || "");
    const payload = rawPayload.replace(/\0+$/g, "").trim();
    const queryResult = {
      device_id: sanitizeText(sn, 80),
      type: sanitizeText(req.query.type, 40),
      table_name: sanitizeText(req.query.tablename, 80),
      command_id: parseIntOrNull(req.query.cmdid),
      count: parseIntOrNull(req.query.count),
      pack_count: parseIntOrNull(req.query.packcnt),
      pack_index: parseIntOrNull(req.query.packidx),
      body: payload.length <= 262144 ? payload : "",
      body_truncated: payload.length > 262144,
      padding_bytes: rawPayload.length - rawPayload.replace(/\0+$/g, "").length,
      created_at: new Date().toISOString(),
    };

    rememberQueryResult(queryResult);

    const receivedCount = payload.split(/\r?\n/).filter((line) => line.trim()).length;
    console.log(`QUERYDATA SN=${sn} table=${queryResult.table_name || "?"} cmd=${queryResult.command_id ?? "?"} records=${receivedCount}`);
    // Security PUSH expects the table name and received record count. A plain
    // OK here can leave query uploads retrying even after their data arrived.
    const tableName = String(queryResult.table_name || "");
    return res.send(/^[a-z][a-z0-9_]{0,39}$/i.test(tableName) ? `${tableName}=${receivedCount}` : "OK");
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
    if ((dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) ||
        (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo))) {
      return res.status(400).json({ error: "invalid_date_filter" });
    }
    const deviceId = sanitizeText(req.query.device_id, 80);
    const biometricId = parseIntOrNull(req.query.biometric_id);

    const data = await db.listAttendance({ limit, deviceId, biometricId, dateFrom, dateTo });
    return res.json({ data });
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

    const executed = executedRaw === "true" ? true : executedRaw === "false" ? false : null;
    const data = await db.listDeviceCommands({ limit, deviceId, executed });
    return res.json({ data, delivery_paused: isCommandDeliveryPaused() });
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
    const requestedDeviceIp = sanitizeText(payload.device_ip, 80);
    if (requestedDeviceIp && !isLocalClockAddress(requestedDeviceIp)) {
      return res.status(400).json({ error: "invalid_device_ip" });
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
    const deviceIp = requestedDeviceIp || ZK_DEVICE_IP;

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
      synced: false,
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

    try {
      await db.insertCommands([{ device_id: deviceId, command, executed: false }]);
    } catch (error) {
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

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const customerId = payload.customer_id == null ? null : String(payload.customer_id).trim();
    const userId = payload.user_id == null ? null : String(payload.user_id).trim();
    if (customerId && userId) {
      return res.status(400).json({ success: false, error: "ambiguous_profile_id" });
    }
    if (customerId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) {
      return res.status(400).json({ success: false, error: "invalid_customer_id" });
    }
    if (userId !== null && !uuidPattern.test(userId)) {
      return res.status(400).json({ success: false, error: "invalid_user_id" });
    }

    const result = await reconcileDeviceUsers(deviceId, customerId ?? userId,
      customerId ? "client" : userId ? "internal" : null);
    if (!result.success) {
      return res.status(404).json(result);
    }
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

app.get("/health/ready", async (_req, res) => {
  try {
    await db.ready();
    res.status(200).send("OK");
  } catch {
    res.status(503).send("ERROR");
  }
});

if (require.main === module) {
  db.ready()
    .then(() => app.listen(PORT, HOST, () => {
      console.log(`🚀 SERVIDOR LISTO EN PUERTO ${PORT}`);
    }))
    .catch((error) => {
      console.error("No se pudo iniciar sync con PostgreSQL local:", error.message);
      process.exitCode = 1;
      void db.close();
    });
}

module.exports = { app, db, parseAttlogLine, parseAccessEventLine };
