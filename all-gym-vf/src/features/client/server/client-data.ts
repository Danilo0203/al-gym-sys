import { cookies } from "next/headers";

import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import type {
  ClientApiEnvelope,
  ClientMembershipPayload,
  ClientProfilePayload,
  ClientRoutinePayload,
} from "@/features/client/types";

function withMeta<T>(data: T): ClientApiEnvelope<T> {
  return { data, meta: { fetched_at: new Date().toISOString() } };
}

async function fetchOwnData<T>(path: "/me/profile" | "/me/membership" | "/me/routine"): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  const response = await fetchAuthBackend(path, {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  if (response.status === 401) throw new Error("UNAUTHORIZED");
  if (!response.ok) throw new Error("No se pudieron cargar los datos del portal local.");
  return await response.json() as T;
}

export async function getCurrentClientProfileData(): Promise<ClientApiEnvelope<ClientProfilePayload>> {
  return withMeta(await fetchOwnData<ClientProfilePayload>("/me/profile"));
}

export async function getCurrentClientMembershipData(): Promise<ClientApiEnvelope<ClientMembershipPayload>> {
  return withMeta(await fetchOwnData<ClientMembershipPayload>("/me/membership"));
}

export async function getCurrentClientRoutineData(): Promise<ClientApiEnvelope<ClientRoutinePayload>> {
  return withMeta(await fetchOwnData<ClientRoutinePayload>("/me/routine"));
}
