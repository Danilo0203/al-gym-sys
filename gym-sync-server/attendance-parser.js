const { createHash } = require("node:crypto");

function parseIntOrNull(value) {
  const raw = String(value ?? "").trim();
  if (!/^-?\d+$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isSafeInteger(number) && number >= -2147483648 && number <= 2147483647 ? number : null;
}

function parseTabbedKvLine(rawLine) {
  return String(rawLine || "").split("\t").map((part) => part.trim()).filter(Boolean)
    .reduce((fields, part) => {
      const separator = part.indexOf("=");
      if (separator < 0) return fields;
      const key = part.slice(0, separator).trim().toLowerCase();
      if (key) fields[key] = part.slice(separator + 1).trim();
      return fields;
    }, Object.create(null));
}

function isAccessEventLine(rawLine) {
  const fields = parseTabbedKvLine(rawLine);
  // USER rows contain StartTime/EndTime, which are not an attendance Time field.
  return Object.hasOwn(fields, "time") && Object.hasOwn(fields, "pin");
}

function createAttendanceParsers(utcOffset = "-06:00") {
  function toIsoOrNull(value) {
    if (!value) return null;
    const normalized = String(value).replace(" ", "T");
    const explicitZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
    const date = new Date(explicitZone ? normalized : `${normalized}${utcOffset}`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function parseAttlogLine(rawLine, sn) {
    const line = String(rawLine || "").trim();
    if (!line) return null;
    const tokens = line.includes("\t") ? line.split("\t").map((part) => part.trim())
      : line.split(/\s+/).map((part) => part.trim()).filter(Boolean);
    if (tokens.length < 2) return null;
    const offset = tokens[0].toUpperCase() === "ATTLOG" ? 1 : 0;
    const biometricId = parseIntOrNull(tokens[offset]);
    if (biometricId == null || biometricId <= 0) return null;
    const firstTimestampToken = tokens[offset + 1] || "";
    const secondTimestampToken = tokens[offset + 2] || "";
    const hasCombinedTimestamp = /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(firstTimestampToken);
    const hasSplitTimestamp = /\d{4}-\d{2}-\d{2}/.test(firstTimestampToken) && /\d{2}:\d{2}:\d{2}/.test(secondTimestampToken);
    let timestamp;
    let statusIndex;
    if (hasCombinedTimestamp) {
      timestamp = firstTimestampToken;
      statusIndex = offset + 2;
    } else if (hasSplitTimestamp) {
      timestamp = `${firstTimestampToken} ${secondTimestampToken}`;
      statusIndex = offset + 3;
    } else {
      return null;
    }
    const punchTime = toIsoOrNull(timestamp);
    if (!punchTime) return null;
    return {
      device_id: String(sn ?? "").trim().slice(0, 80) || null,
      biometric_id: biometricId,
      punch_time: punchTime,
      status1: parseIntOrNull(tokens[statusIndex]),
      status2: parseIntOrNull(tokens[statusIndex + 1]),
      status3: parseIntOrNull(tokens[statusIndex + 2]),
      status4: parseIntOrNull(tokens[statusIndex + 3]),
      status5: parseIntOrNull(tokens[statusIndex + 4]),
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
    if (biometricId == null || biometricId <= 0 || !punchTime) return null;
    return {
      device_id: String(sn ?? "").trim().slice(0, 80) || null,
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

  function parseNonPersonAccessEvent(rawLine, sn) {
    const line = String(rawLine || "").trim();
    const fields = parseTabbedKvLine(line);
    const pin = parseIntOrNull(fields.pin);
    const time = toIsoOrNull(fields.time);
    const event = parseIntOrNull(fields.event);
    if (pin !== 0 || !time || event == null || event < 0) return null;
    // A device event without a person is not an attendance row. Keep only
    // bounded metadata so its acknowledgement is traceable without card data.
    return {
      device_id: String(sn ?? "").trim().slice(0, 80) || null,
      time,
      event,
      index: parseIntOrNull(fields.index),
      sha256: createHash("sha256").update(line).digest("hex"),
    };
  }

  // Only allow numeric identifiers and timestamp syntax into diagnostic output.
  // Unknown fields (including biometric templates) are never logged as values.
  function describeInvalidAccessEvent(rawLine) {
    const line = String(rawLine || "").trim();
    const fields = parseTabbedKvLine(line);
    const pin = parseIntOrNull(fields.pin);
    const timeValid = Boolean(toIsoOrNull(fields.time));
    const safeTime = typeof fields.time === "string" &&
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/i.test(fields.time)
      ? fields.time : null;
    return {
      sha256: createHash("sha256").update(line).digest("hex"),
      bytes: Buffer.byteLength(line),
      keys: Object.keys(fields).filter((key) => /^[a-z][a-z0-9_.-]{0,39}$/.test(key)).slice(0, 24),
      pin,
      pin_state: fields.pin == null ? "missing" : pin == null ? "invalid" : pin === 0 ? "zero" : pin < 0 ? "negative" : "positive",
      time: safeTime,
      time_valid: timeValid,
      event: parseIntOrNull(fields.event),
      separators: {
        tabs: (line.match(/\t/g) || []).length,
        spaces: (line.match(/ /g) || []).length,
        commas: (line.match(/,/g) || []).length,
        semicolons: (line.match(/;/g) || []).length,
        pipes: (line.match(/\|/g) || []).length,
      },
      reasons: [
        ...(pin == null || pin <= 0 ? ["invalid_pin"] : []),
        ...(!timeValid ? ["invalid_time"] : []),
      ],
    };
  }

  function describeInvalidAccessBatch(lines) {
    const invalidLines = lines.filter((line) => !parseAccessEventLine(line, "diagnostic") &&
      !parseNonPersonAccessEvent(line, "diagnostic"));
    return {
      sha256: createHash("sha256").update(lines.join("\n")).digest("hex"),
      line_count: lines.length,
      invalid_count: invalidLines.length,
      samples: invalidLines.slice(0, 3).map(describeInvalidAccessEvent),
    };
  }

  return { parseAttlogLine, parseAccessEventLine, parseNonPersonAccessEvent, isAccessEventLine,
    describeInvalidAccessEvent, describeInvalidAccessBatch };
}

module.exports = { createAttendanceParsers };
