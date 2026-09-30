/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverGetCustomerRoutineWorkspace } from "@/features/customers/lib/customer-routine-server-api";
import { customerRoutineMutationResponseSchema } from "@/features/customers/lib/local-customer-routine";
import { parseCustomerApiResponse } from "@/features/customers/lib/local-customers";
import { saveRoutineAsBlueprint } from "@/features/routines/actions/blueprint-actions";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { normalizeExerciseCatalogItem } from "@/lib/training/catalog";
import { isExerciseMediaStoredLocally } from "@/lib/training/exercise-media";
import {
  buildExerciseReplacementGroups,
  searchExerciseCatalogItems,
} from "@/lib/training/exercise-recommendations";
import { buildRoutineProposal, ROUTINE_ENGINE_VERSION } from "@/lib/training/routine-engine";
import {
  getMissingTrainingProfileRequirements,
  isTrainingProfileComplete,
  normalizeTrainingProfileInput,
} from "@/lib/training/profile";
import type {
  CustomerRoutineWorkspace,
  ExerciseCatalogItem,
  ExerciseReplacementGroup,
  NutritionContext,
  ProviderExerciseSummary,
  RoutineDetailRecord,
  RoutineReplacementContext,
  RoutineRecord,
  RoutineProposal,
  TrainingProfileInput,
  TrainingProfileRecord,
} from "@/lib/training/types";

type AdminSupabaseClient = any;

function mapTrainingProfileRow(row: Record<string, unknown> | null): TrainingProfileRecord | null {
  if (!row || typeof row.id !== "string" || typeof row.user_id !== "string") return null;

  return {
    id: row.id,
    user_id: row.user_id,
    primary_goal: typeof row.primary_goal === "string" ? (row.primary_goal as TrainingProfileRecord["primary_goal"]) : null,
    secondary_goal:
      typeof row.secondary_goal === "string" ? (row.secondary_goal as TrainingProfileRecord["secondary_goal"]) : null,
    focus_areas: Array.isArray(row.focus_areas) ? (row.focus_areas as TrainingProfileRecord["focus_areas"]) : [],
    experience_level:
      typeof row.experience_level === "string"
        ? (row.experience_level as TrainingProfileRecord["experience_level"])
        : null,
    days_per_week: typeof row.days_per_week === "number" ? row.days_per_week : null,
    session_minutes: typeof row.session_minutes === "number" ? row.session_minutes : null,
    training_location:
      typeof row.training_location === "string"
        ? (row.training_location as TrainingProfileRecord["training_location"])
        : null,
    equipment_available: Array.isArray(row.equipment_available)
      ? (row.equipment_available as TrainingProfileRecord["equipment_available"])
      : [],
    activity_level:
      typeof row.activity_level === "string" ? (row.activity_level as TrainingProfileRecord["activity_level"]) : null,
    cardio_preference:
      typeof row.cardio_preference === "string"
        ? (row.cardio_preference as TrainingProfileRecord["cardio_preference"])
        : null,
    exercise_preferences: typeof row.exercise_preferences === "string" ? row.exercise_preferences : null,
    exercise_dislikes: typeof row.exercise_dislikes === "string" ? row.exercise_dislikes : null,
    injuries_or_pain: typeof row.injuries_or_pain === "string" ? row.injuries_or_pain : null,
    restricted_movements: Array.isArray(row.restricted_movements)
      ? (row.restricted_movements as TrainingProfileRecord["restricted_movements"])
      : [],
    parq_requires_attention: typeof row.parq_requires_attention === "boolean" ? row.parq_requires_attention : null,
    medical_clearance_notes: typeof row.medical_clearance_notes === "string" ? row.medical_clearance_notes : null,
    is_complete: row.is_complete === true,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  };
}

function mapRoutineRow(row: Record<string, unknown>): RoutineRecord {
  return {
    id: String(row.id),
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    created_by: typeof row.created_by === "string" ? row.created_by : null,
    name: String(row.name || "Rutina"),
    start_date: typeof row.start_date === "string" ? row.start_date : null,
    end_date: typeof row.end_date === "string" ? row.end_date : null,
    is_active: typeof row.is_active === "boolean" ? row.is_active : null,
    goal: typeof row.goal === "string" ? row.goal : null,
    status: String(row.status || "draft") as RoutineRecord["status"],
    source: String(row.source || "system") as RoutineRecord["source"],
    training_profile_id: typeof row.training_profile_id === "string" ? row.training_profile_id : null,
    primary_goal: typeof row.primary_goal === "string" ? row.primary_goal : null,
    secondary_goal: typeof row.secondary_goal === "string" ? row.secondary_goal : null,
    generation_version: typeof row.generation_version === "string" ? row.generation_version : null,
    reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

function mapRoutineDetailRow(row: Record<string, unknown>): RoutineDetailRecord {
  const exercise = row.exercise && typeof row.exercise === "object" ? (row.exercise as Record<string, unknown>) : null;
  const linkedExerciseName =
    typeof exercise?.display_name_es === "string"
      ? exercise.display_name_es
      : typeof exercise?.display_name === "string"
        ? exercise.display_name
        : typeof exercise?.name === "string"
          ? exercise.name
          : null;
  const linkedImageUrl = typeof exercise?.image_url === "string" && isExerciseMediaStoredLocally(exercise.image_url)
    ? exercise.image_url
    : null;

  return {
    id: Number(row.id),
    routine_id: String(row.routine_id),
    day_of_week: Number(row.day_of_week || 0),
    exercise_id: typeof row.exercise_id === "number" ? row.exercise_id : null,
    exercise_order: typeof row.exercise_order === "number" ? row.exercise_order : null,
    block_type: String(row.block_type || "strength") as RoutineDetailRecord["block_type"],
    sets: typeof row.sets === "number" ? row.sets : null,
    reps: typeof row.reps === "string" ? row.reps : null,
    rest_seconds: typeof row.rest_seconds === "number" ? row.rest_seconds : null,
    duration_minutes: typeof row.duration_minutes === "number" ? row.duration_minutes : null,
    target_rir: typeof row.target_rir === "number" ? row.target_rir : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    exercise_name_snapshot:
      linkedExerciseName || (typeof row.exercise_name_snapshot === "string" ? row.exercise_name_snapshot : null),
    exercise_image_url: linkedImageUrl,
    exercise_video_url: null,
  };
}

async function requireLocalRoutineAccess() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !hasPermission(access, "customers.manage_routine") || !access.userId) {
    throw new Error("No autorizado");
  }

  return access;
}

async function requireAdminAccess() {
  const access = await requireLocalRoutineAccess();
  return {
    access,
    adminClient: createAdminClient(),
  };
}

async function getNutritionContextForUser(adminClient: AdminSupabaseClient, userId: string): Promise<NutritionContext> {
  const [{ data: profile }, { data: assessment }] = await Promise.all([
    adminClient.from("profiles").select("birth_date, gender").eq("id", userId).maybeSingle(),
    adminClient
      .from("body_assessments")
      .select("weight_kg, height_cm, body_type, diet_type, activity_level")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    birthDate: profile?.birth_date ? new Date(profile.birth_date) : null,
    gender: profile?.gender || null,
    weightKg: typeof assessment?.weight_kg === "number" ? assessment.weight_kg : null,
    heightCm: typeof assessment?.height_cm === "number" ? assessment.height_cm : null,
    bodyType: assessment?.body_type || null,
    dietType: assessment?.diet_type || null,
    activityLevel: assessment?.activity_level || null,
  };
}

async function listExerciseCatalog(): Promise<ExerciseCatalogItem[]> {
  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
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

async function hydrateRoutineDetailVisuals(details: RoutineDetailRecord[], catalog: ExerciseCatalogItem[]) {
  return details.map((detail) => {
    const matched =
      catalog.find((exercise) => exercise.id === detail.exercise_id) ||
      (detail.exercise_name_snapshot
        ? searchExerciseCatalogItems(catalog, { query: detail.exercise_name_snapshot, limit: 1 })[0]
        : null);
    const localImageUrl = matched && isExerciseMediaStoredLocally(matched.image_url)
      ? matched.image_url
      : null;
    return {
      ...detail,
      exercise_image_url: localImageUrl,
      exercise_video_url: null,
    };
  });
}

async function archiveDraftsAndPending(adminClient: AdminSupabaseClient, userId: string) {
  const { error } = await adminClient
    .from("routines")
    .update({ status: "archived", is_active: false })
    .eq("user_id", userId)
    .in("status", ["draft", "pending_profile"]);

  if (error) throw error;
}

async function ensurePendingRoutine(params: {
  adminClient: AdminSupabaseClient;
  userId: string;
  createdBy: string;
  trainingProfileId?: string | null;
  primaryGoal?: string | null;
  secondaryGoal?: string | null;
}) {
  const { adminClient, userId, createdBy, trainingProfileId, primaryGoal, secondaryGoal } = params;

  const { data: existing } = await adminClient
    .from("routines")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending_profile")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await adminClient
      .from("routines")
      .update({
        training_profile_id: trainingProfileId ?? null,
        primary_goal: primaryGoal ?? null,
        secondary_goal: secondaryGoal ?? null,
        generation_version: ROUTINE_ENGINE_VERSION,
      })
      .eq("id", existing.id);

    return existing.id;
  }

  const { data: pendingRoutine, error } = await adminClient
    .from("routines")
    .insert({
      user_id: userId,
      created_by: createdBy,
      name: "Rutina pendiente de perfil",
      is_active: false,
      goal: "Pendiente de perfil",
      status: "pending_profile",
      source: "system",
      training_profile_id: trainingProfileId ?? null,
      primary_goal: primaryGoal ?? null,
      secondary_goal: secondaryGoal ?? null,
      generation_version: ROUTINE_ENGINE_VERSION,
    })
    .select("id")
    .single();

  if (error) throw error;
  return pendingRoutine.id;
}

async function persistRoutineDraft(params: {
  adminClient: AdminSupabaseClient;
  userId: string;
  createdBy: string;
  trainingProfileId: string;
  proposal: RoutineProposal;
  primaryGoal: string | null;
  secondaryGoal: string | null;
}) {
  const { adminClient, userId, createdBy, trainingProfileId, proposal, primaryGoal, secondaryGoal } = params;

  await archiveDraftsAndPending(adminClient, userId);

  const { data: routine, error: routineError } = await adminClient
    .from("routines")
    .insert({
      user_id: userId,
      created_by: createdBy,
      name: `Propuesta ${primaryGoal || "personalizada"}`,
      is_active: false,
      goal: primaryGoal || "Personalizada",
      status: "draft",
      source: "system",
      training_profile_id: trainingProfileId,
      primary_goal: primaryGoal,
      secondary_goal: secondaryGoal,
      generation_version: ROUTINE_ENGINE_VERSION,
    })
    .select("id")
    .single();

  if (routineError || !routine) throw routineError || new Error("No se pudo crear la rutina");

  const detailRows = proposal.days.flatMap((day) =>
    day.exercises.map((exercise) => ({
      routine_id: routine.id,
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
    })),
  );

  if (detailRows.length > 0) {
    const { error: detailsError } = await adminClient.from("routine_details").insert(detailRows);
    if (detailsError) throw detailsError;
  }

  return routine.id;
}

async function fetchTrainingProfileInternal(adminClient: AdminSupabaseClient, userId: string) {
  const { data, error } = await adminClient
    .from("training_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return mapTrainingProfileRow((data as Record<string, unknown> | null) ?? null);
}

async function upsertTrainingProfileInternal(params: {
  adminClient: AdminSupabaseClient;
  userId: string;
  trainingProfile: TrainingProfileInput;
  nutritionContext: NutritionContext;
}) {
  const normalized = normalizeTrainingProfileInput(params.trainingProfile);
  const isComplete = isTrainingProfileComplete(normalized, params.nutritionContext);

  const payload = {
    user_id: params.userId,
    primary_goal: normalized.primary_goal,
    secondary_goal: normalized.secondary_goal,
    focus_areas: normalized.focus_areas ?? [],
    experience_level: normalized.experience_level,
    days_per_week: normalized.days_per_week,
    session_minutes: normalized.session_minutes,
    training_location: normalized.training_location,
    equipment_available: normalized.equipment_available ?? [],
    activity_level: normalized.activity_level,
    cardio_preference: normalized.cardio_preference,
    exercise_preferences: normalized.exercise_preferences,
    exercise_dislikes: normalized.exercise_dislikes,
    injuries_or_pain: normalized.injuries_or_pain,
    restricted_movements: normalized.restricted_movements ?? [],
    parq_requires_attention: normalized.parq_requires_attention,
    medical_clearance_notes: normalized.medical_clearance_notes,
    is_complete: isComplete,
  };

  const { data, error } = await params.adminClient
    .from("training_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;

  await params.adminClient
    .from("profiles")
    .update({ training_profile_status: isComplete ? "complete" : "pending" })
    .eq("id", params.userId);

  return mapTrainingProfileRow(data as Record<string, unknown>);
}

async function generateRoutineDraftInternal(params: {
  adminClient: AdminSupabaseClient;
  userId: string;
  createdBy: string;
}) {
  const trainingProfile = await fetchTrainingProfileInternal(params.adminClient, params.userId);
  if (!trainingProfile) {
    await ensurePendingRoutine({
      adminClient: params.adminClient,
      userId: params.userId,
      createdBy: params.createdBy,
    });
    return { success: false, error: "No hay perfil de entrenamiento todavía." };
  }

  const nutritionContext = await getNutritionContextForUser(params.adminClient, params.userId);
  const proposal = buildRoutineProposal({
    trainingProfile,
    nutritionContext,
    exercises: await listExerciseCatalog(),
  });

  if (proposal.status === "pending_profile") {
    await ensurePendingRoutine({
      adminClient: params.adminClient,
      userId: params.userId,
      createdBy: params.createdBy,
      trainingProfileId: trainingProfile.id,
      primaryGoal: trainingProfile.primary_goal ?? null,
      secondaryGoal: trainingProfile.secondary_goal ?? null,
    });

    return {
      success: false as const,
      error: "Aún falta información para generar la propuesta.",
      missingRequirements: proposal.missingRequirements,
      warnings: proposal.warnings,
    };
  }

  const routineId = await persistRoutineDraft({
    adminClient: params.adminClient,
    userId: params.userId,
    createdBy: params.createdBy,
    trainingProfileId: trainingProfile.id,
    proposal,
    primaryGoal: trainingProfile.primary_goal ?? null,
    secondaryGoal: trainingProfile.secondary_goal ?? null,
  });

  return { success: true, routineId, warnings: proposal.warnings };
}

export async function syncTrainingProfileWithAdmin(params: {
  adminClient: AdminSupabaseClient;
  userId: string;
  createdBy: string;
  trainingProfile: TrainingProfileInput;
  nutritionContext: NutritionContext;
}) {
  const trainingProfile = await upsertTrainingProfileInternal({
    adminClient: params.adminClient,
    userId: params.userId,
    trainingProfile: params.trainingProfile,
    nutritionContext: params.nutritionContext,
  });

  await archiveDraftsAndPending(params.adminClient, params.userId).catch(() => null);

  if (trainingProfile?.is_complete) {
    const generation = await generateRoutineDraftInternal({
      adminClient: params.adminClient,
      userId: params.userId,
      createdBy: params.createdBy,
    });

    return {
      trainingProfile,
      generation,
      missingRequirements: [],
    };
  }

  await ensurePendingRoutine({
    adminClient: params.adminClient,
    userId: params.userId,
    createdBy: params.createdBy,
    trainingProfileId: trainingProfile?.id ?? null,
    primaryGoal: trainingProfile?.primary_goal ?? null,
    secondaryGoal: trainingProfile?.secondary_goal ?? null,
  });

  return {
    trainingProfile,
    generation: null,
    missingRequirements: getMissingTrainingProfileRequirements(trainingProfile || {}, params.nutritionContext),
  };
}

export async function upsertTrainingProfile(userId: string, input: TrainingProfileInput) {
  const { adminClient, access } = await requireAdminAccess();
  const nutritionContext = await getNutritionContextForUser(adminClient, userId);
  const result = await syncTrainingProfileWithAdmin({
    adminClient,
    userId,
    createdBy: access.userId!,
    trainingProfile: input,
    nutritionContext,
  });

  revalidatePath("/panel/clientes");
  revalidatePath(`/panel/clientes/${userId}`);
  revalidatePath(`/panel/clientes/${userId}/history`);

  return {
    success: true,
    data: result.trainingProfile,
    missingRequirements: result.missingRequirements,
  };
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

export async function approveRoutineDraft(routineId: string) {
  const { adminClient, access } = await requireAdminAccess();

  const { data: routine, error: routineError } = await adminClient
    .from("routines")
    .select("id, user_id, status")
    .eq("id", routineId)
    .single();

  if (routineError || !routine?.user_id) {
    throw new Error("No se encontró la rutina.");
  }

  if (routine.status !== "draft") {
    throw new Error("Solo se pueden aprobar rutinas en borrador.");
  }

  await adminClient
    .from("routines")
    .update({ status: "archived", is_active: false })
    .eq("user_id", routine.user_id)
    .in("status", ["active", "pending_profile"]);

  const { error } = await adminClient
    .from("routines")
    .update({
      status: "active",
      is_active: true,
      source: "admin",
      reviewed_by: access.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", routineId);

  if (error) throw error;

  revalidatePath(`/panel/clientes/${routine.user_id}`);
  revalidatePath(`/panel/clientes/${routine.user_id}/history`);
  revalidatePath(`/panel/clientes/${routine.user_id}/rutina/borrador`);
  revalidatePath(`/panel/clientes/${routine.user_id}/rutina/activa`);

  return { success: true };
}

export async function archiveRoutine(routineId: string) {
  const result = await saveRoutineAsBlueprint(routineId);
  return result;
}

export async function updateRoutineDetail(
  detailId: number,
  patch: Partial<Pick<RoutineDetailRecord, "sets" | "reps" | "rest_seconds" | "duration_minutes" | "target_rir" | "notes">>,
) {
  const { adminClient } = await requireAdminAccess();

  const { data: detail, error: detailError } = await adminClient
    .from("routine_details")
    .select("id, routine_id, routines!inner(id, user_id, status)")
    .eq("id", detailId)
    .single();

  if (detailError || !detail) {
    throw new Error("No se encontró el detalle de rutina.");
  }

  const routine = Array.isArray(detail.routines) ? detail.routines[0] : detail.routines;
  if (!routine || (routine.status !== "draft" && routine.status !== "active")) {
    throw new Error("Solo puedes editar detalles de una rutina en borrador o activa.");
  }

  const { error } = await adminClient
    .from("routine_details")
    .update({
      sets: patch.sets ?? null,
      reps: patch.reps ?? null,
      rest_seconds: patch.rest_seconds ?? null,
      duration_minutes: patch.duration_minutes ?? null,
      target_rir: patch.target_rir ?? null,
      notes: patch.notes ?? null,
    })
    .eq("id", detailId);

  if (error) throw error;

  revalidatePath(`/panel/clientes/${routine.user_id}`);
  revalidatePath(`/panel/clientes/${routine.user_id}/history`);

  return { success: true };
}

export async function replaceRoutineExercise(detailId: number, exerciseId: number) {
  const { adminClient } = await requireAdminAccess();

  const [{ data: detail, error: detailError }, { data: exercise, error: exerciseError }] = await Promise.all([
    adminClient
      .from("routine_details")
      .select("id, routine_id, routines!inner(id, user_id, status)")
      .eq("id", detailId)
      .single(),
    adminClient.from("exercises").select("id, display_name, display_name_es, name").eq("id", exerciseId).single(),
  ]);

  if (detailError || !detail) {
    throw new Error("No se encontró el detalle de rutina.");
  }

  const routine = Array.isArray(detail.routines) ? detail.routines[0] : detail.routines;
  if (!routine || routine.status !== "draft") {
    throw new Error("Solo puedes reemplazar ejercicios en una rutina en borrador.");
  }

  if (exerciseError || !exercise) {
    throw new Error("No se encontró el ejercicio.");
  }

  const { error } = await adminClient
    .from("routine_details")
    .update({
      exercise_id: exerciseId,
      exercise_name_snapshot: exercise.display_name_es || exercise.display_name || exercise.name,
      notes: null,
    })
    .eq("id", detailId);

  if (error) throw error;

  revalidatePath(`/panel/clientes/${routine.user_id}`);
  revalidatePath(`/panel/clientes/${routine.user_id}/history`);

  return { success: true };
}

export async function getRoutineExerciseReplacementOptions(customerId: string, detailId: number): Promise<{
  success: true;
  data: {
    context: RoutineReplacementContext;
    groups: ExerciseReplacementGroup[];
  };
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

  const currentExercise =
    detail.exercise_id && Number.isFinite(detail.exercise_id)
      ? catalog.find((exercise) => exercise.id === detail.exercise_id) || null
      : null;

  const replacement = buildExerciseReplacementGroups({
    catalog,
    detail,
    currentExercise,
    trainingProfile: workspace.trainingProfile,
    limitPerGroup: 6,
  });

  return {
    success: true,
    data: {
      context: replacement.context,
      groups: replacement.groups,
    },
  };
}

export async function searchExerciseCatalog(filters: {
  query?: string;
  bodyPart?: string;
  targetMuscle?: string;
  equipment?: string;
  limit?: number;
}) {
  await requireLocalRoutineAccess();
  const catalog = await listExerciseCatalog();

  return {
    success: true,
    data: searchExerciseCatalogItems(catalog, filters),
  };
}

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

export async function seedExerciseCatalog() {
  await requireLocalRoutineAccess();
  return {
    success: false,
    importedCount: 0,
    failedKeywords: [] as string[],
    errors: ["Importa los ejercicios y sus imágenes desde archivos locales."],
    message: "La importación externa está deshabilitada.",
  };
}

async function getRoutineWorkspaceForUser(
  adminClient: AdminSupabaseClient,
  customerId: string,
): Promise<CustomerRoutineWorkspace> {
  const [trainingProfile, nutritionContext, routinesResponse] = await Promise.all([
    fetchTrainingProfileInternal(adminClient, customerId),
    getNutritionContextForUser(adminClient, customerId),
    adminClient
      .from("routines")
      .select("*")
      .eq("user_id", customerId)
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false }),
  ]);

  if (routinesResponse.error) throw routinesResponse.error;

  const routines: RoutineRecord[] = (routinesResponse.data || []).map((row: Record<string, unknown>) => mapRoutineRow(row));
  const draftRoutine = routines.find((routine: RoutineRecord) => routine.status === "draft") || null;
  const activeRoutine = routines.find((routine: RoutineRecord) => routine.status === "active") || null;
  const pendingRoutine = routines.find((routine: RoutineRecord) => routine.status === "pending_profile") || null;
  const detailsRoutineIds = [draftRoutine?.id, activeRoutine?.id, pendingRoutine?.id].filter(Boolean) as string[];

  let detailsByRoutineId: Record<string, RoutineDetailRecord[]> = {};
  if (detailsRoutineIds.length > 0) {
    const { data: details, error: detailsError } = await adminClient
      .from("routine_details")
      .select("*, exercise:exercises(id, name, display_name, display_name_es, image_url, video_url)")
      .in("routine_id", detailsRoutineIds)
      .order("day_of_week", { ascending: true })
      .order("exercise_order", { ascending: true })
      .order("id", { ascending: true });

    if (detailsError) throw detailsError;

    let mappedDetails: RoutineDetailRecord[] = (details || []).map((row: Record<string, unknown>) => mapRoutineDetailRow(row));

    if (mappedDetails.some((detail) => detail.exercise_name_snapshot)) {
      mappedDetails = await hydrateRoutineDetailVisuals(mappedDetails, await listExerciseCatalog());
    }

    detailsByRoutineId = mappedDetails.reduce<Record<string, RoutineDetailRecord[]>>((accumulator, mapped: RoutineDetailRecord) => {
      accumulator[mapped.routine_id] = accumulator[mapped.routine_id] || [];
      accumulator[mapped.routine_id].push(mapped);
      return accumulator;
    }, {});
  }

  return {
    trainingProfile,
    nutritionContext,
    trainingProfileStatus: trainingProfile?.is_complete ? "complete" : "pending",
    missingRequirements: getMissingTrainingProfileRequirements(trainingProfile || {}, nutritionContext),
    draftRoutine,
    activeRoutine,
    pendingRoutine,
    draftDetails: draftRoutine ? detailsByRoutineId[draftRoutine.id] || [] : [],
    activeDetails: activeRoutine ? detailsByRoutineId[activeRoutine.id] || [] : [],
    pendingDetails: pendingRoutine ? detailsByRoutineId[pendingRoutine.id] || [] : [],
  };
}

export async function getCustomerRoutineWorkspace(customerId: string): Promise<CustomerRoutineWorkspace> {
  const { adminClient } = await requireAdminAccess();
  return getRoutineWorkspaceForUser(adminClient, customerId);
}
