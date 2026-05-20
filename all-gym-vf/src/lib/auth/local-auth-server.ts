import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { LocalAuthMeResponse } from "@/lib/auth/local-auth-shared";

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}

export function getApiInternalUrl() {
  const value = process.env.API_INTERNAL_URL;
  if (!value || value.trim().length === 0) {
    return null;
  }

  return normalizeBaseUrl(value);
}

export function isLocalAuthEnabled() {
  return Boolean(getApiInternalUrl());
}

function buildCookieHeader(entries: { name: string; value: string }[]) {
  if (entries.length === 0) {
    return null;
  }

  return entries.map(({ name, value }) => `${name}=${value}`).join("; ");
}

async function fetchLocalMeWithHeaders(input: {
  cookieHeader: string | null;
  userAgent?: string | null;
}) {
  const apiInternalUrl = getApiInternalUrl();
  if (!apiInternalUrl) {
    return null;
  }

  const headers = new Headers({
    Accept: "application/json",
  });

  if (input.cookieHeader) {
    headers.set("Cookie", input.cookieHeader);
  }

  if (input.userAgent) {
    headers.set("User-Agent", input.userAgent);
  }

  const response = await fetch(`${apiInternalUrl}/auth/me`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Local auth /auth/me failed with status ${response.status}`);
  }

  return (await response.json()) as LocalAuthMeResponse;
}

export async function getLocalAuthMeFromRequest(request: NextRequest) {
  return fetchLocalMeWithHeaders({
    cookieHeader: request.headers.get("cookie"),
    userAgent: request.headers.get("user-agent"),
  });
}

export async function getLocalAuthMeFromCookies() {
  const cookieStore = await cookies();

  return fetchLocalMeWithHeaders({
    cookieHeader: buildCookieHeader(cookieStore.getAll()),
  });
}
