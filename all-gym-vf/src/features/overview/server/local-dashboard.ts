import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";

export type LocalDashboardOverviewPayload = Record<string, unknown>;

export class LocalDashboardHttpError extends Error {
  status: number;
  responseText: string;

  constructor(status: number, responseText: string) {
    const detail = responseText.trim() ? ` Response: ${responseText.trim()}` : "";
    super(`Local dashboard backend request failed with status ${status}.${detail}`);
    this.name = "LocalDashboardHttpError";
    this.status = status;
    this.responseText = responseText;
  }
}

function parseOverviewPayload(responseText: string): LocalDashboardOverviewPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(responseText);
  } catch (error) {
    throw new Error(
      `Local dashboard backend returned invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Local dashboard backend returned an invalid overview payload.");
  }

  const maybeWrappedPayload = "data" in parsed ? parsed.data : parsed;

  if (!maybeWrappedPayload || typeof maybeWrappedPayload !== "object" || Array.isArray(maybeWrappedPayload)) {
    throw new Error("Local dashboard backend returned an invalid overview data payload.");
  }

  return maybeWrappedPayload as LocalDashboardOverviewPayload;
}

export const getLocalDashboardOverview = cache(
  async (from?: string, to?: string): Promise<LocalDashboardOverviewPayload> => {
    const cookieStore = await cookies();
    const cookieHeader = buildCookieHeader(cookieStore.getAll());
    const searchParams = new URLSearchParams();

    if (from && to) {
      searchParams.set("from", from);
      searchParams.set("to", to);
    }

    const pathname = searchParams.size > 0 ? `/dashboard/overview?${searchParams.toString()}` : "/dashboard/overview";
    const response = await fetchAuthBackend(pathname, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new LocalDashboardHttpError(response.status, responseText);
    }

    if (!responseText.trim()) {
      throw new Error("Local dashboard backend returned an empty body.");
    }

    return parseOverviewPayload(responseText);
  },
);
