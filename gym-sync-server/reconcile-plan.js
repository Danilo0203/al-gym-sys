const SUPERSEDED_RETURN_CODE = "SUPERSEDED_RECONCILE";

function normalizeCommand(command) {
  return String(command || "").replace(/\s+/g, " ").trim();
}

// Only these state commands belong to reconciliation. Never consume deletion
// of users/templates, enrollment, queries, or arbitrary device commands.
function classifyStateCommand(command) {
  const normalized = normalizeCommand(command);
  const prefix = normalized.match(/^DATA (UPDATE|DELETE) (userauthorize|userinfo|user)\s/i);
  if (!prefix) return null;
  const operation = prefix[1].toUpperCase();
  const table = prefix[2].toLowerCase();
  if (operation === "DELETE" && table !== "userauthorize") return null;
  const matches = [...normalized.matchAll(/(?:^|\s)Pin=(\d+)(?=\s|$)/gi)];
  if (matches.length !== 1) return null;
  const pin = Number(matches[0][1]);
  if (!Number.isSafeInteger(pin) || pin <= 0 || pin > 2147483647) return null;
  return {
    pin,
    family: table === "userauthorize" ? "authorization" : "profile",
    operation,
    normalized,
  };
}

function compareCommandIds(left, right) {
  const a = BigInt(left.id);
  const b = BigInt(right.id);
  return a < b ? -1 : a > b ? 1 : 0;
}

function isAdministrativeResult(returnCode) {
  return /^(?:SUPERSEDED_|SKIPPED_|UNSUPPORTED_)/.test(String(returnCode || ""));
}

/**
 * desiredStates: [{ pin, commands: string[] }]. An absent profile command means
 * that profile writes are unnecessary (known device user or denied access),
 * so older pending profile writes for that target are retired as well.
 */
function planDeviceReconciliation({
  desiredStates,
  history,
  successReturns = ["0"],
  protectedCommandIds = [],
}) {
  const successes = new Set([...successReturns].map((value) => String(value).trim()).filter(Boolean));
  const protectedIds = new Set([...protectedCommandIds].map(String));
  const targets = new Map();
  for (const state of desiredStates) {
    const pin = Number(state.pin);
    if (!Number.isSafeInteger(pin) || pin <= 0 || pin > 2147483647 || targets.has(pin)) {
      throw new Error("Invalid or duplicate reconciliation PIN");
    }
    const desired = new Map();
    for (const command of state.commands) {
      const classified = classifyStateCommand(command);
      if (!classified || classified.pin !== pin || desired.has(classified.family)) {
        throw new Error("Invalid or duplicate desired state command");
      }
      desired.set(classified.family, { ...classified, command });
    }
    targets.set(pin, { desired, invalidated: new Set(state.invalidateConfirmedFamilies || []) });
  }

  const grouped = new Map();
  for (const row of [...history].sort(compareCommandIds)) {
    const classified = classifyStateCommand(row.command);
    if (!classified || !targets.has(classified.pin)) continue;
    const key = `${classified.pin}:${classified.family}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ ...row, ...classified });
  }

  const supersededIds = [];
  const commands = [];
  for (const [pin, { desired, invalidated }] of targets) {
    let pendingProfileBoundary = null;
    let profileWillBeQueued = false;
    for (const family of ["profile", "authorization"]) {
      const expected = desired.get(family);
      const rows = grouped.get(`${pin}:${family}`) || [];
      const pending = rows.filter((row) => row.executed === false);
      // Retain an in-flight matching command first; otherwise retain the last
      // matching queued command, after any in-flight conflicting operation.
      const conflictingProtected = pending.filter((row) => protectedIds.has(String(row.id)) &&
        (!expected || row.normalized !== expected.normalized));
      const lastConflict = conflictingProtected.at(-1);
      const authorizationNeedsProfile = family === "authorization" && expected?.operation === "UPDATE" && desired.has("profile");
      const matching = expected
        ? pending.filter((row) => row.normalized === expected.normalized)
          .filter((row) => !lastConflict || compareCommandIds(row, lastConflict) > 0)
          .filter((row) => !authorizationNeedsProfile || (!profileWillBeQueued &&
            (!pendingProfileBoundary || compareCommandIds(row, pendingProfileBoundary) > 0)))
        : [];
      const retained = matching.find((row) => protectedIds.has(String(row.id))) || matching.at(-1);
      const conflictingPending = pending.some((row) => !expected || row.normalized !== expected.normalized);
      for (const row of pending) {
        if (protectedIds.has(String(row.id))) {
          continue;
        }
        if (retained && String(row.id) === String(retained.id)) continue;
        supersededIds.push(row.id);
      }
      if (family === "profile" && expected) {
        // Any profile write that still needs delivery must precede its grant.
        // A retained grant with an older ID would otherwise reach the clock
        // before the retained creation, even though both match desired state.
        pendingProfileBoundary = pending.filter((row) => protectedIds.has(String(row.id)) ||
          (retained && String(row.id) === String(retained.id))).at(-1) || null;
      }
      if (!expected || retained) continue;
      // A failed or empty acknowledgement is not confirmation. Administrative
      // retirement of a queue item does not describe the device's state.
      const lastResult = rows.filter((row) => row.executed === true && !isAdministrativeResult(row.return_code)).at(-1);
      const confirmed = lastResult && successes.has(String(lastResult.return_code || "").trim()) &&
        lastResult.normalized === expected.normalized;
      // Even a non-inflight stale command might have reached the clock before
      // a process restart lost its acknowledgement. Follow it with known state.
      const needsGrantAfterCreation = authorizationNeedsProfile && (profileWillBeQueued || pendingProfileBoundary);
      if (!confirmed || conflictingPending || invalidated.has(family) || needsGrantAfterCreation) {
        commands.push(expected.command);
        if (family === "profile") profileWillBeQueued = true;
      }
    }
  }
  return { supersededIds, commands, supersededReturnCode: SUPERSEDED_RETURN_CODE };
}

module.exports = { SUPERSEDED_RETURN_CODE, classifyStateCommand, normalizeCommand, planDeviceReconciliation };
