"use server";

import { cookies } from "next/headers";

import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { normalizeExerciseCatalogItem } from "@/lib/training/catalog";
import { searchExerciseCatalogItems } from "@/lib/training/exercise-recommendations";
import type { ExerciseCatalogItem, ProviderExerciseSummary } from "@/lib/training/types";

async function listLocalExercises(): Promise<ExerciseCatalogItem[]> {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !hasPermission(access, "routines.view")) {
    throw new Error("No autorizado");
  }

  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  const response = await fetchAuthBackend("/exercises", {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  if (!response.ok) throw new Error("No se pudo consultar el catálogo local de ejercicios.");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) {
    throw new Error("El backend devolvió un catálogo inválido.");
  }
  return (payload.data as Record<string, unknown>[]).map(normalizeExerciseCatalogItem);
}

export async function searchExerciseCatalog(filters: {
  query?: string;
  bodyPart?: string;
  targetMuscle?: string;
  equipment?: string;
  limit?: number;
}) {
  return {
    success: true as const,
    data: searchExerciseCatalogItems(await listLocalExercises(), filters),
  };
}

// Compatibilidad temporal para componentes que aún importan estas acciones.
// La búsqueda/importación externa no forma parte de la operación sin internet.
export async function searchExerciseProvider(
  input: string | { query: string; limit?: number; offset?: number },
) {
  const limit = typeof input === "string" ? 12 : Math.min(Math.max(input.limit ?? 12, 1), 24);
  const offset = typeof input === "string" ? 0 : Math.max(input.offset ?? 0, 0);
  return {
    success: true as const,
    data: [] as ProviderExerciseSummary[],
    hasMore: false,
    nextOffset: null,
    limit,
    offset,
  };
}

export async function importExerciseFromProvider(_rawExercise: Record<string, unknown>): Promise<{ success: true; data: ExerciseCatalogItem }> {
  void _rawExercise;
  throw new Error("La importación externa está deshabilitada. Añade el ejercicio con una imagen local.");
}
