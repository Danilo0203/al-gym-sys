function parseBooleanEnv(value: string | undefined, fallback = false) {
  if (value == null || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export const OAUTH_LOGIN_ENABLED = parseBooleanEnv(process.env.NEXT_PUBLIC_ENABLE_OAUTH_LOGIN, false);
export const PASSWORD_RECOVERY_ENABLED = parseBooleanEnv(process.env.NEXT_PUBLIC_ENABLE_PASSWORD_RECOVERY, false);
