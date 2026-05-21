const GUATEMALA_PHONE_PREFIX = "+502";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAuthEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeGuatemalaPhoneForAuth(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;

  const digits = value.replace(/\D/g, "");

  if (digits.length === 8) {
    return `${GUATEMALA_PHONE_PREFIX}${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("502")) {
    return `+${digits}`;
  }

  return null;
}

export function isValidAuthEmail(value: string | null | undefined): boolean {
  const normalizedEmail = normalizeAuthEmail(value);
  return Boolean(normalizedEmail && EMAIL_REGEX.test(normalizedEmail));
}

export function isValidPasswordLoginIdentifier(value: string | null | undefined): boolean {
  if (isValidAuthEmail(value)) {
    return true;
  }

  return normalizeGuatemalaPhoneForAuth(value) !== null;
}

export function resolvePasswordSignInCredentials(identifier: string, password: string) {
  const normalizedEmail = normalizeAuthEmail(identifier);
  if (normalizedEmail && EMAIL_REGEX.test(normalizedEmail)) {
    return { email: normalizedEmail, password };
  }

  const normalizedPhone = normalizeGuatemalaPhoneForAuth(identifier);
  if (normalizedPhone) {
    return { phone: normalizedPhone, password };
  }

  return null;
}
