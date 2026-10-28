"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { routineProgressSchema, type RoutineProgressChange } from "@/features/client/lib/routine-progress";
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

async function fetchClientApi<T>(pathname: string, signal?: AbortSignal): Promise<ClientApiEnvelope<T>> {
  const response = await fetch(pathname, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal,
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
    queryFn: ({ signal }) => fetchClientApi<ClientRoutinePayload>("/api/me/routine", signal),
    // The gym's LAN can be available even when the phone reports no Internet.
    networkMode: "always",
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useRoutineProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async (change: RoutineProgressChange) => {
      const response = await fetch("/api/me/routine/progress", {
        method: "day" in change ? "DELETE" : "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(change),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "No se pudo guardar tu avance. Inténtalo de nuevo.");
      return routineProgressSchema.parse(payload);
    },
    onMutate: () => queryClient.cancelQueries({ queryKey: ["client-app", "routine"] }),
    onSuccess: async (progress) => {
      await queryClient.cancelQueries({ queryKey: ["client-app", "routine"] });
      queryClient.setQueryData<ClientApiEnvelope<ClientRoutinePayload>>(["client-app", "routine"], (previous) => {
        if (!previous || previous.data.workspace.activeRoutine?.id !== progress.routineId) return previous;
        return { ...previous, data: { ...previous.data, progress } };
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["client-app", "routine"] }),
  });
}
