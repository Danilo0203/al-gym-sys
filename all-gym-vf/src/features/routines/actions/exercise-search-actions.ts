"use server";

import { cookies } from "next/headers";

import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { normalizeExerciseCatalogItem } from "@/lib/training/catalog";
import { searchExerciseCatalogItems } from "@/lib/training/exercise-recommendations";
import type { ExerciseCatalogItem } from "@/lib/training/types";

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
