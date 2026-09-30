const DEFAULT_AUTH_BACKEND_TIMEOUT_MS = 5_000;

export class AuthBackendTransportError extends Error {
  readonly kind: "timeout" | "unavailable";

  constructor(kind: "timeout" | "unavailable") {
    super(kind === "timeout" ? "Local auth backend timed out." : "Local auth backend is unavailable.");
    this.name = "AuthBackendTransportError";
    this.kind = kind;
  }
}

export function getAuthBackendUrl(): URL {
  const configuredValue = process.env.ALGYM_BACKEND_URL?.trim();

  if (!configuredValue) {
    throw new AuthBackendTransportError("unavailable");
  }

  let backendUrl: URL;

  try {
    backendUrl = new URL(configuredValue);
  } catch {
    throw new AuthBackendTransportError("unavailable");
  }

  if (
    !["http:", "https:"].includes(backendUrl.protocol) ||
    backendUrl.username ||
    backendUrl.password ||
    backendUrl.search ||
    backendUrl.hash
  ) {
    throw new AuthBackendTransportError("unavailable");
  }

  backendUrl.pathname = `${backendUrl.pathname.replace(/\/+$/, "")}/`;
  return backendUrl;
}

export function buildAuthBackendUrl(pathname: string): URL {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    throw new AuthBackendTransportError("unavailable");
  }

  const backendUrl = getAuthBackendUrl();
  const targetUrl = new URL(pathname.slice(1), backendUrl);

  if (targetUrl.origin !== backendUrl.origin) {
    throw new AuthBackendTransportError("unavailable");
  }

  return targetUrl;
}

export async function fetchAuthBackend(
  pathname: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_AUTH_BACKEND_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const handleCallerAbort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", handleCallerAbort, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(buildAuthBackendUrl(pathname), {
      ...init,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof AuthBackendTransportError) {
      throw error;
    }

    if (timedOut) {
      throw new AuthBackendTransportError("timeout");
    }

    throw new AuthBackendTransportError("unavailable");
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", handleCallerAbort);
  }
}

export function buildCookieHeader(
  cookiesToForward: Array<{ name: string; value: string }>,
): string | null {
  if (cookiesToForward.length === 0) return null;
  return cookiesToForward.map(({ name, value }) => `${name}=${value}`).join("; ");
}

function splitCombinedSetCookieHeader(value: string): string[] {
  const cookies: string[] = [];
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== ",") continue;

    const remainder = value.slice(index + 1);
    if (!/^\s*[^=;,\s]+\s*=/.test(remainder)) continue;

    cookies.push(value.slice(start, index).trim());
    start = index + 1;
  }

  cookies.push(value.slice(start).trim());
  return cookies.filter(Boolean);
}

export function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithSetCookie.getSetCookie === "function") {
    return headersWithSetCookie.getSetCookie();
  }

  const combinedHeader = headers.get("set-cookie");
  return combinedHeader ? splitCombinedSetCookieHeader(combinedHeader) : [];
}
