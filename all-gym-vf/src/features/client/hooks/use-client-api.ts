"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  ClientApiEnvelope,
  ClientMembershipPayload,
  ClientProfilePayload,
  ClientRoutinePayload,
} from "@/features/client/types";

class ClientApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchClientApi<T>(pathname: string): Promise<ClientApiEnvelope<T>> {
  const response = await fetch(pathname, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "No fue posible cargar la información.";
    const payload = await response.json().catch(() => null);
    if (payload && typeof payload.error === "string") {
      message = payload.error;
    }

    throw new ClientApiError(message, response.status);
  }

  return (await response.json()) as ClientApiEnvelope<T>;
}

export function useClientProfile() {
  return useQuery({
    queryKey: ["client-app", "profile"],
    queryFn: () => fetchClientApi<ClientProfilePayload>("/api/me/profile"),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

export function useClientMembership() {
  return useQuery({
    queryKey: ["client-app", "membership"],
    queryFn: () => fetchClientApi<ClientMembershipPayload>("/api/me/membership"),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

export function useClientRoutine() {
  return useQuery({
    queryKey: ["client-app", "routine"],
    queryFn: () => fetchClientApi<ClientRoutinePayload>("/api/me/routine"),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
