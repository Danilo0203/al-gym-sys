export const DEFAULT_SUBSCRIPTION_GRACE_DAYS = 3;

export function normalizeGraceDays(value: unknown, fallback = DEFAULT_SUBSCRIPTION_GRACE_DAYS) {
  if (value === "" || value === null || value === undefined) return fallback;

  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return fallback;

  return Math.max(0, Math.trunc(numericValue));
}

export function parseLocalDate(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function formatLocalDate(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getSubscriptionAccessUntilDate(
  endDate: Date | string | null | undefined,
  graceDays: unknown = DEFAULT_SUBSCRIPTION_GRACE_DAYS,
) {
  const parsedEndDate = parseLocalDate(endDate);
  if (!parsedEndDate) return null;

  const accessUntil = new Date(parsedEndDate);
  accessUntil.setDate(accessUntil.getDate() + normalizeGraceDays(graceDays));

  const dayOfWeek = accessUntil.getDay();
  if (dayOfWeek === 6) {
    accessUntil.setDate(accessUntil.getDate() + 2);
  } else if (dayOfWeek === 0) {
    accessUntil.setDate(accessUntil.getDate() + 1);
  }

  return accessUntil;
}

export function getSubscriptionAccessUntilISO(
  endDate: Date | string | null | undefined,
  graceDays: unknown = DEFAULT_SUBSCRIPTION_GRACE_DAYS,
) {
  return formatLocalDate(getSubscriptionAccessUntilDate(endDate, graceDays));
}

export function todayLocalISO() {
  return formatLocalDate(new Date())!;
}

export function isDateWithinSubscriptionAccess(
  endDate: Date | string | null | undefined,
  graceDays: unknown = DEFAULT_SUBSCRIPTION_GRACE_DAYS,
  referenceDate: Date | string = new Date(),
) {
  const accessUntil = getSubscriptionAccessUntilISO(endDate, graceDays);
  const reference = formatLocalDate(parseLocalDate(referenceDate));

  if (!accessUntil || !reference) return false;
  return accessUntil >= reference;
}
