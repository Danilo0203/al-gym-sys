export function getAuthBackendUrl(): string {
  const backendUrl = process.env.ALGYM_BACKEND_URL?.trim().replace(/\/$/, "");

  if (!backendUrl) {
    throw new Error("Missing ALGYM_BACKEND_URL for local auth.");
  }

  return backendUrl;
}

export function buildCookieHeader(cookiesToForward: Array<{ name: string; value: string }>): string | null {
  if (cookiesToForward.length === 0) {
    return null;
  }

  return cookiesToForward.map(({ name, value }) => `${name}=${value}`).join("; ");
}

export async function fetchAuthBackend(pathname: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(pathname, getAuthBackendUrl()).toString();

  return fetch(url, {
    ...init,
    cache: "no-store",
    redirect: "manual",
  });
}

export function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithSetCookie.getSetCookie === "function") {
    return headersWithSetCookie.getSetCookie();
  }

  const singleHeader = headers.get("set-cookie");
  return singleHeader ? [singleHeader] : [];
}
