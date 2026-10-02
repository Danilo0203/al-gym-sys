"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { serverGetCustomerRoutineWorkspace } from "@/features/customers/lib/customer-routine-server-api";
import { customerRoutineMutationResponseSchema } from "@/features/customers/lib/local-customer-routine";
import { parseCustomerApiResponse } from "@/features/customers/lib/local-customers";
import { saveRoutineAsBlueprint } from "@/features/routines/actions/blueprint-actions";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { normalizeExerciseCatalogItem } from "@/lib/training/catalog";
import {
  buildExerciseReplacementGroups,
  searchExerciseCatalogItems,
} from "@/lib/training/exercise-recommendations";
import { buildRoutineProposal, ROUTINE_ENGINE_VERSION } from "@/lib/training/routine-engine";
import type {
  ExerciseCatalogItem,
  ExerciseReplacementGroup,
  NutritionContext,
  RoutineReplacementContext,
} from "@/lib/training/types";

async function requireLocalRoutineAccess() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !hasPermission(access, "customers.manage_routine") || !access.userId) {
    throw new Error("No autorizado");
  }
  return access;
}

async function listExerciseCatalog(): Promise<ExerciseCatalogItem[]> {
  const cookieHeader = buildCookieHeader((await cookies()).getAll());
  const response = await fetchAuthBackend("/exercises", {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  if (!response.ok) throw new Error("No se pudo consultar el catálogo local de ejercicios.");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) {
    throw new Error("El backend local devolvió un catálogo inválido.");
  }
  return (payload.data as Record<string, unknown>[]).map(normalizeExerciseCatalogItem);
}

export async function generateRoutineProposal(userId: string) {
  await requireLocalRoutineAccess();
  const workspace = await serverGetCustomerRoutineWorkspace(userId);
  if (!workspace) throw new Error("No se encontró el cliente.");

  const trainingProfile = workspace.trainingProfile;
  const nutritionContext: NutritionContext = {
    ...workspace.nutritionContext,
    birthDate: workspace.nutritionContext.birthDate
      ? new Date(`${workspace.nutritionContext.birthDate}T00:00:00`)
      : null,
  };
  const proposal = trainingProfile
    ? buildRoutineProposal({
        trainingProfile,
        nutritionContext,
        exercises: await listExerciseCatalog(),
      })
    : null;

  const pending = !proposal || proposal.status === "pending_profile";
  const body = {
    status: pending ? "pending_profile" : "draft",
    name: pending ? "Rutina pendiente de perfil" : `Propuesta ${trainingProfile?.primary_goal || "personalizada"}`,
    goal: pending ? "Pendiente de perfil" : trainingProfile?.primary_goal || "Personalizada",
    training_profile_id: trainingProfile?.id ?? null,
    primary_goal: trainingProfile?.primary_goal ?? null,
    secondary_goal: trainingProfile?.secondary_goal ?? null,
    generation_version: ROUTINE_ENGINE_VERSION,
    details: pending ? [] : proposal.days.flatMap((day) => day.exercises.map((exercise) => ({
      day_of_week: day.dayIndex,
      exercise_id: exercise.exerciseId,
      exercise_order: exercise.exerciseOrder,
      block_type: exercise.blockType,
      sets: exercise.sets,
      reps: exercise.reps,
      rest_seconds: exercise.restSeconds,
      duration_minutes: exercise.durationMinutes,
      target_rir: exercise.targetRir,
      notes: exercise.requiresReview ? exercise.reason || "Requiere revisión" : null,
      exercise_name_snapshot: exercise.exerciseName,
    }))),
  };

  const cookieHeader = buildCookieHeader((await cookies()).getAll());
  const response = await fetchAuthBackend(`/customers/${userId}/routines/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const saved = await parseCustomerApiResponse(response, (payload) => customerRoutineMutationResponseSchema.parse(payload));

  revalidatePath(`/panel/clientes/${userId}`);
  revalidatePath(`/panel/clientes/${userId}/history`);
  revalidatePath(`/panel/clientes/${userId}/rutina/borrador`);
  revalidatePath(`/panel/clientes/${userId}/rutina/activa`);

  if (pending) {
    return {
      success: false as const,
      error: trainingProfile ? "Aún falta información para generar la propuesta." : "No hay perfil de entrenamiento todavía.",
      missingRequirements: proposal?.missingRequirements ?? workspace.missingRequirements,
      warnings: proposal?.warnings ?? [],
    };
  }
  return { success: true as const, routineId: saved.routine.id, warnings: proposal.warnings };
}

// El botón de la ficha guarda la rutina actual como plantilla reutilizable.
export async function archiveRoutine(routineId: string) {
  return saveRoutineAsBlueprint(routineId);
}

export async function getRoutineExerciseReplacementOptions(customerId: string, detailId: number): Promise<{
  success: true;
  data: { context: RoutineReplacementContext; groups: ExerciseReplacementGroup[] };
}> {
  await requireLocalRoutineAccess();
  const [workspace, catalog] = await Promise.all([
    serverGetCustomerRoutineWorkspace(customerId),
    listExerciseCatalog(),
  ]);
  if (!workspace?.draftRoutine) {
    throw new Error("Solo puedes revisar sugerencias en una rutina en borrador.");
  }
  const detail = workspace.draftDetails.find((item) => item.id === detailId);
  if (!detail) throw new Error("No se encontró el detalle de rutina.");

  const currentExercise = detail.exercise_id && Number.isFinite(detail.exercise_id)
    ? catalog.find((exercise) => exercise.id === detail.exercise_id) || null
    : null;
  const replacement = buildExerciseReplacementGroups({
    catalog,
    detail,
    currentExercise,
    trainingProfile: workspace.trainingProfile,
    limitPerGroup: 6,
  });
  return { success: true, data: { context: replacement.context, groups: replacement.groups } };
}

export async function searchExerciseCatalog(filters: {
  query?: string;
  bodyPart?: string;
  targetMuscle?: string;
  equipment?: string;
  limit?: number;
}) {
  await requireLocalRoutineAccess();
  return { success: true, data: searchExerciseCatalogItems(await listExerciseCatalog(), filters) };
}
