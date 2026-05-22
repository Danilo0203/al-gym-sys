import { cookies } from "next/headers";

function parseBooleanEnv(value: string | undefined, fallback = false) {
  if (value == null || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export class LocalApiError extends Error {
  status: number;
  code: string | null;
  details: unknown;

  constructor(message: string, status: number, code?: string | null, details?: unknown) {
    super(message);
    this.name = "LocalApiError";
    this.status = status;
    this.code = code ?? null;
    this.details = details ?? null;
  }
}

export function isLocalAuthEnabled() {
  if (parseBooleanEnv(process.env.ALLGYM_LOCAL_AUTH_ENABLED, false)) {
    return true;
  }

  return Boolean(process.env.API_INTERNAL_URL?.trim());
}

export function getLocalApiBaseUrl() {
  const apiInternalUrl = process.env.API_INTERNAL_URL?.trim();

  if (!apiInternalUrl) {
    throw new Error("API_INTERNAL_URL is required for local runtime requests.");
  }

  return normalizeBaseUrl(apiInternalUrl);
}

function buildCookieHeader(entries: { name: string; value: string }[]) {
  return entries.map(({ name, value }) => `${name}=${value}`).join("; ");
}

export async function requestLocalApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies();
  const headers = new Headers(init.headers);
  const cookieHeader = buildCookieHeader(cookieStore.getAll());

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  if (init.body != null && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const response = await fetch(`${getLocalApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: string; message?: string; details?: unknown }
    | null;

  if (!response.ok) {
    throw new LocalApiError(
      payload?.message || payload?.error || `Local API request failed with status ${response.status}`,
      response.status,
      payload?.error,
      payload?.details,
    );
  }

  return ((payload && "data" in payload ? payload.data : payload) ?? null) as T;
}
