import "server-only";

import { cookies } from "next/headers";

import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { normalizeExerciseCatalogItem } from "@/lib/training/catalog";
import type { ExerciseCatalogItem } from "@/lib/training/types";

export async function getLocalExercises(): Promise<{ data: ExerciseCatalogItem[]; total: number }> {
  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  const response = await fetchAuthBackend("/exercises", {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  if (!response.ok) throw new Error("No se pudo cargar el catálogo local de ejercicios.");

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) {
    throw new Error("El backend devolvió un catálogo de ejercicios inválido.");
  }
  const rows = payload.data as Record<string, unknown>[];
  return { data: rows.map(normalizeExerciseCatalogItem), total: rows.length };
}
