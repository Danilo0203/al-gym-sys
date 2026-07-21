import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { z } from "zod";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { getAuthErrorMessage, parseJsonText } from "@/lib/auth/contracts";

const localProfileSchema = z.object({
  id: z.uuid(),
  email: z.string().email().nullable(),
  full_name: z.string(),
  phone: z.string(),
  birth_date: z.string(),
  gender: z.enum(["male", "female", "other"]),
  avatar_url: z.string().nullable(),
  role: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const updateLocalProfileInputSchema = z
  .object({
    full_name: z.string().trim().min(2).optional(),
    phone: z.string().optional(),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "EMPTY_PROFILE_UPDATE",
  });

export type LocalProfile = z.infer<typeof localProfileSchema>;
export type LocalProfileUpdateInput = z.infer<typeof updateLocalProfileInputSchema>;

export class LocalProfileHttpError extends Error {
  status: number;
  responseText: string;

  constructor(status: number, responseText: string) {
    let message: string | null = null;

    if (responseText.trim()) {
      try {
        message = getAuthErrorMessage(parseJsonText(responseText, "Local profile backend"));
      } catch {
        message = null;
      }
    }

    super(message ?? `Local profile backend request failed with status ${status}.`);
    this.name = "LocalProfileHttpError";
    this.status = status;
    this.responseText = responseText;
  }
}

function parseLocalProfile(payload: unknown): LocalProfile {
  const result = localProfileSchema.safeParse(payload);

  if (!result.success) {
    throw new Error("Local profile backend returned an invalid profile contract.");
  }

  return result.data;
}

function unwrapProfilePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Local profile backend returned an invalid payload.");
  }

  if ("data" in payload) {
    return payload.data;
  }

  return payload;
}

async function getServerCookieHeader() {
  const cookieStore = await cookies();
  return buildCookieHeader(cookieStore.getAll());
}

export const getLocalProfile = cache(async (): Promise<LocalProfile> => {
  let response: Response;

  try {
    const cookieHeader = await getServerCookieHeader();
    response = await fetchAuthBackend("/profile", {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(
      `Could not reach local profile backend: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new LocalProfileHttpError(response.status, responseText);
  }

  return parseLocalProfile(unwrapProfilePayload(parseJsonText(responseText, "Local profile backend")));
});

export async function updateLocalProfile(input: LocalProfileUpdateInput): Promise<LocalProfile> {
  const payload = updateLocalProfileInputSchema.parse(input);
  let response: Response;

  try {
    const cookieHeader = await getServerCookieHeader();
    response = await fetchAuthBackend("/profile", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(
      `Could not reach local profile backend: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new LocalProfileHttpError(response.status, responseText);
  }

  return parseLocalProfile(unwrapProfilePayload(parseJsonText(responseText, "Local profile backend")));
}
