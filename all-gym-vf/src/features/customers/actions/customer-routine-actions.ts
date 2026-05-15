/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveRoutineAsBlueprint } from "@/features/routines/actions/blueprint-actions";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { normalizeExerciseCatalogItem, mapProviderExerciseToCatalogPayload } from "@/lib/training/catalog";
import {
  hydrateProviderExerciseSummaries,
  resolveExerciseImageUrl,
  resolveProviderExercisePayloadMedia,
} from "@/lib/training/exercise-media";
import {
  buildExerciseReplacementGroups,
  getExerciseDisplayName,
  buildExerciseSearchVariants,
  normalizeExerciseSearchText,
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

const EXERCISE_CATALOG_FUNCTION = "exercise-catalog-provider";
const EXERCISEDB_DIRECT_HOST = "exercisedb.p.rapidapi.com";
const EXERCISEDB_PUBLIC_V1_BASE_URL = "https://www.exercisedb.dev";
const PUBLIC_EXERCISE_MEDIA_CACHE = new Map<string, Promise<{ imageUrl: string | null; videoUrl: string | null }>>();
const EXERCISE_PROVIDER_SEARCH_DEFAULT_LIMIT = 12;
const EXERCISE_PROVIDER_SEARCH_MAX_LIMIT = 24;
const EXERCISE_PROVIDER_SEARCH_MAX_ROUNDS = 8;
const EXERCISE_PROVIDER_TARGET_TERMS = new Set([
  "abductors",
  "abs",
  "adductors",
  "biceps",
  "calf",
  "calves",
  "core",
  "forearms",
  "glute",
  "glutes",
  "hamstrings",
  "lats",
  "lower back",
  "pectorals",
  "quads",
  "quadriceps",
  "shoulders",
  "traps",
  "triceps",
]);
const EXERCISE_PROVIDER_BODY_PART_TERMS = new Set([
  "back",
  "cardio",
  "chest",
  "lower arms",
  "lower legs",
  "neck",
  "shoulders",
  "upper arms",
  "upper legs",
  "waist",
]);
const EXERCISE_PROVIDER_EQUIPMENT_TERMS = new Set([
  "assisted",
  "band",
  "barbell",
  "body weight",
  "bosu ball",
  "cable",
  "dumbbell",
  "elliptical machine",
  "ez barbell",
  "hammer",
  "kettlebell",
  "leverage machine",
  "medicine ball",
  "olympic barbell",
  "resistance band",
  "roller",
  "rope",
  "skierg machine",
  "sled machine",
  "smith machine",
  "stability ball",
  "stationary bike",
  "stepmill machine",
  "tire",
  "trap bar",
  "upper body ergometer",
  "weighted",
  "wheel roller",
]);

function isBrokenExerciseMediaUrl(url: string | null | undefined) {
  if (!url) return false;
  const normalizedUrl = url.trim().toLowerCase();
  return normalizedUrl === "" || normalizedUrl === "null" || normalizedUrl === "undefined";
}

function normalizeDirectProviderSummary(item: Record<string, unknown>) {
  return {
    exerciseId:
      typeof item.exerciseId === "string"
        ? item.exerciseId
        : typeof item.id === "string"
          ? item.id
          : "",
    name: typeof item.name === "string" ? item.name : "Exercise",
    imageUrl:
      typeof item.imageUrl === "string"
        ? item.imageUrl
        : typeof item.gifUrl === "string"
          ? item.gifUrl
          : null,
  };
}

function normalizeDirectProviderDetail(item: Record<string, unknown>) {
  const exerciseId =
    typeof item.exerciseId === "string"
      ? item.exerciseId
      : typeof item.id === "string"
        ? item.id
        : "";
  const bodyPart = typeof item.bodyPart === "string" ? item.bodyPart : null;
  const equipment = typeof item.equipment === "string" ? item.equipment : null;
  const target = typeof item.target === "string" ? item.target : null;
  const imageUrl =
    typeof item.imageUrl === "string"
      ? item.imageUrl
      : typeof item.gifUrl === "string"
        ? item.gifUrl
        : null;

  return {
    exerciseId,
    name: typeof item.name === "string" ? item.name : "Exercise",
    imageUrl,
    bodyParts: bodyPart ? [bodyPart] : [],
    equipments: equipment ? [equipment] : [],
    targetMuscles: target ? [target] : [],
    secondaryMuscles: Array.isArray(item.secondaryMuscles) ? item.secondaryMuscles : [],
    instructions: Array.isArray(item.instructions) ? item.instructions : [],
    rawPayload: item,
  };
}

function resolveDirectProviderExerciseId(body: Record<string, unknown>) {
  if (typeof body.exerciseId === "string" && body.exerciseId.trim()) {
    return body.exerciseId.trim();
  }

  const exercise = body.exercise;
  if (!exercise || typeof exercise !== "object") return null;
  const normalizedExercise = exercise as Record<string, unknown>;

  if (typeof normalizedExercise.exerciseId === "string" && normalizedExercise.exerciseId.trim()) {
    return normalizedExercise.exerciseId.trim();
  }

  if (typeof normalizedExercise.id === "string" && normalizedExercise.id.trim()) {
    return normalizedExercise.id.trim();
  }

  if (typeof normalizedExercise.provider_item_id === "string" && normalizedExercise.provider_item_id.trim()) {
    return normalizedExercise.provider_item_id.trim();
  }

  return null;
}

async function fetchExerciseProviderDirect(path: string, searchParams?: Record<string, string | undefined>) {
  const rapidApiKey = process.env.EXERCISEDB_RAPIDAPI_KEY?.trim();
  if (!rapidApiKey) {
    throw new Error("Falta EXERCISEDB_RAPIDAPI_KEY en el entorno del servidor.");
  }

  const url = new URL(path, `https://${EXERCISEDB_DIRECT_HOST}`);
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value && value.trim()) {
      url.searchParams.set(key, value.trim());
    }
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": rapidApiKey,
      "X-RapidAPI-Host": EXERCISEDB_DIRECT_HOST,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage =
      payload?.error?.message || payload?.message || payload?.error || `ExerciseDB request failed with ${response.status}`;
    throw new Error(providerMessage);
  }

  return payload;
}

async function searchProviderDirectByPath(
  path: string,
  merged: Map<string, ReturnType<typeof normalizeDirectProviderSummary>>,
  searchParams?: Record<string, string | undefined>,
) {
  try {
    const payload = await fetchExerciseProviderDirect(path, searchParams);

    let added = 0;
    for (const item of Array.isArray(payload) ? payload : []) {
      const normalized = normalizeDirectProviderSummary((item || {}) as Record<string, unknown>);
      if (normalized.exerciseId && !merged.has(normalized.exerciseId)) {
        merged.set(normalized.exerciseId, normalized);
        added += 1;
      }
    }

    return added;
  } catch {
    // Ignore endpoint misses so broader search variants can continue.
    return 0;
  }
}

function clampProviderSearchLimit(value: unknown) {
  const numericLimit = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericLimit)) return EXERCISE_PROVIDER_SEARCH_DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(numericLimit), 1), EXERCISE_PROVIDER_SEARCH_MAX_LIMIT);
}

function clampProviderSearchOffset(value: unknown) {
  const numericOffset = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericOffset)) return 0;
  return Math.max(0, Math.trunc(numericOffset));
}

function buildProviderSearchPaths(query: string, rawVariants?: unknown) {
  const variantsFromBody = Array.isArray(rawVariants)
    ? rawVariants.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const variants = uniqueStrings([query, ...variantsFromBody, ...buildExerciseSearchVariants(query)]).slice(0, 8);
  const paths: string[] = [];

  const addPath = (path: string) => {
    if (!paths.includes(path)) {
      paths.push(path);
    }
  };

  for (const variant of variants) {
    addPath(`/exercises/name/${encodeURIComponent(variant)}`);
  }

  for (const variant of variants) {
    if (EXERCISE_PROVIDER_TARGET_TERMS.has(variant)) {
      addPath(`/exercises/target/${encodeURIComponent(variant)}`);
    }

    if (EXERCISE_PROVIDER_BODY_PART_TERMS.has(variant)) {
      addPath(`/exercises/bodyPart/${encodeURIComponent(variant)}`);
    }

    if (EXERCISE_PROVIDER_EQUIPMENT_TERMS.has(variant)) {
      addPath(`/exercises/equipment/${encodeURIComponent(variant)}`);
    }
  }

  return paths;
}

async function searchExerciseProviderDirectPage(params: {
  query: string;
  limit?: unknown;
  offset?: unknown;
  searchVariants?: unknown;
}) {
  const query = params.query.trim();
  const limit = clampProviderSearchLimit(params.limit);
  const offset = clampProviderSearchOffset(params.offset);

  if (!query) {
    return {
      success: true as const,
      data: [] as ProviderExerciseSummary[],
      offset,
      limit,
      hasMore: false,
      nextOffset: null as number | null,
    };
  }

  const merged = new Map<string, ReturnType<typeof normalizeDirectProviderSummary>>();
  const searchPaths = buildProviderSearchPaths(query, params.searchVariants);
  const requiredCount = offset + limit + 1;
  const chunkSize = Math.max(limit, EXERCISE_PROVIDER_SEARCH_DEFAULT_LIMIT);
  let exhausted = false;

  for (let round = 0; round < EXERCISE_PROVIDER_SEARCH_MAX_ROUNDS && merged.size < requiredCount; round += 1) {
    const roundOffset = round * chunkSize;
    let addedThisRound = 0;

    for (const path of searchPaths) {
      addedThisRound += await searchProviderDirectByPath(path, merged, {
        limit: String(chunkSize),
        offset: String(roundOffset),
      });

      if (merged.size >= requiredCount) {
        break;
      }
    }

    if (addedThisRound === 0) {
      exhausted = true;
      break;
    }
  }

  const items = Array.from(merged.values());
  const data = items.slice(offset, offset + limit) as ProviderExerciseSummary[];
  const hasMore = items.length > offset + limit || (!exhausted && data.length === limit);

  return {
    success: true as const,
    data,
    offset,
    limit,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  };
}

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
    exercise_image_url: typeof exercise?.image_url === "string" ? exercise.image_url : null,
    exercise_video_url: typeof exercise?.video_url === "string" ? exercise.video_url : null,
  };
}

async function requireAdminAccess() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !hasPermission(access, "customers.manage_routine") || !access.userId) {
    throw new Error("No autorizado");
  }

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

async function listExerciseCatalog(adminClient: AdminSupabaseClient): Promise<ExerciseCatalogItem[]> {
  const { data, error } = await adminClient
    .from("exercises")
    .select(
      "id, slug, name, display_name, display_name_es, provider, provider_item_id, is_favorite, is_preview_hidden, body_parts, target_muscles, secondary_muscles, equipments, exercise_type, instructions, tips, keywords, variations, image_url, video_url, description, raw_payload, last_synced_at, is_active",
    )
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => normalizeExerciseCatalogItem(row));
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

async function fetchPublicExerciseMedia(query: string) {
  const cacheKey = normalizeExerciseSearchText(query);
  if (!cacheKey) {
    return { imageUrl: null, videoUrl: null };
  }

  const cached = PUBLIC_EXERCISE_MEDIA_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    const variants = uniqueStrings([query, ...buildExerciseSearchVariants(query)]).slice(0, 8);

    for (const variant of variants) {
      try {
        const url = new URL("/api/v1/exercises/search", EXERCISEDB_PUBLIC_V1_BASE_URL);
        url.searchParams.set("q", variant);
        url.searchParams.set("limit", "5");
        url.searchParams.set("threshold", "0.25");

        const response = await fetch(url.toString(), {
          cache: "force-cache",
          next: { revalidate: 60 * 60 * 24 },
        });

        if (!response.ok) {
          continue;
        }

        const payload = (await response.json().catch(() => null)) as
          | {
              data?: Array<{
                name?: string;
                gifUrl?: string;
              }>;
            }
          | null;

        const results = Array.isArray(payload?.data) ? payload.data : [];
        const match = results.find((item) => typeof item.gifUrl === "string" && item.gifUrl.trim());

        if (match?.gifUrl) {
          return {
            imageUrl: match.gifUrl,
            videoUrl: null,
          };
        }
      } catch {
        continue;
      }
    }

    return {
      imageUrl: null,
      videoUrl: null,
    };
  })();

  PUBLIC_EXERCISE_MEDIA_CACHE.set(cacheKey, request);
  return request;
}

async function hydrateRoutineDetailVisuals(details: RoutineDetailRecord[], catalog: ExerciseCatalogItem[]) {
  const mediaCatalog = catalog.filter((exercise) => Boolean(exercise.image_url) && !isBrokenExerciseMediaUrl(exercise.image_url));

  return Promise.all(
    details.map(async (detail) => {
      if (!detail.exercise_name_snapshot) {
        return detail;
      }

      const localMatches = searchExerciseCatalogItems(catalog, {
        query: detail.exercise_name_snapshot,
        limit: 3,
      });

      const localMediaMatch =
        mediaCatalog.find((exercise) => localMatches.some((candidate) => candidate.id === exercise.id)) || null;

      const candidateQueries = uniqueStrings([
        ...localMatches.map((exercise) => getExerciseDisplayName(exercise)),
        detail.exercise_name_snapshot,
        ...buildExerciseSearchVariants(detail.exercise_name_snapshot),
      ]);
      const fallbackQuery = candidateQueries[0];
      const resolvedImageUrl = await resolveExerciseImageUrl({
        imageUrl: localMediaMatch?.image_url || detail.exercise_image_url,
        name: detail.exercise_name_snapshot,
        fallbackQueries: candidateQueries,
      });
      const resolvedVideoUrl = detail.exercise_video_url || localMediaMatch?.video_url || null;

      if (resolvedImageUrl || resolvedVideoUrl) {
        return {
          ...detail,
          exercise_image_url: resolvedImageUrl,
          exercise_video_url: resolvedVideoUrl,
        };
      }

      if (!fallbackQuery) {
        return {
          ...detail,
          exercise_image_url: null,
          exercise_video_url: null,
        };
      }

      const publicMedia = await fetchPublicExerciseMedia(fallbackQuery);
      if (!publicMedia.imageUrl) {
        return {
          ...detail,
          exercise_image_url: null,
          exercise_video_url: null,
        };
      }

      return {
        ...detail,
        exercise_image_url: publicMedia.imageUrl,
        exercise_video_url: publicMedia.videoUrl,
      };
    }),
  );
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
    exercises: await listExerciseCatalog(params.adminClient),
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
      success: false,
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

async function callExerciseCatalogFunction(body: Record<string, unknown>) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !hasPermission(access, "exercises.view")) {
    throw new Error("No autorizado");
  }

  if (process.env.EXERCISEDB_RAPIDAPI_KEY?.trim()) {
    const operation = typeof body.operation === "string" ? body.operation : "";

    if (operation === "search") {
      const query = typeof body.query === "string" ? body.query.trim() : "";
      return searchExerciseProviderDirectPage({
        query,
        limit: body.limit,
        offset: body.offset,
        searchVariants: body.searchVariants,
      });
    }

    const exerciseId = resolveDirectProviderExerciseId(body);
    if (!exerciseId) {
      throw new Error("exerciseId es obligatorio para importar o refrescar.");
    }

    const payload = await fetchExerciseProviderDirect(`/exercises/exercise/${exerciseId}`);
    return {
      success: true,
      data: normalizeDirectProviderDetail((payload || {}) as Record<string, unknown>),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke(EXERCISE_CATALOG_FUNCTION, {
    body,
  });

  if (error) {
    throw new Error(error.message || "No se pudo conectar con ExerciseDB.");
  }

  return data;
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
  const { adminClient, access } = await requireAdminAccess();
  const result = await generateRoutineDraftInternal({
    adminClient,
    userId,
    createdBy: access.userId!,
  });

  revalidatePath(`/panel/clientes/${userId}`);
  revalidatePath(`/panel/clientes/${userId}/history`);
  revalidatePath(`/panel/clientes/${userId}/rutina/borrador`);
  revalidatePath(`/panel/clientes/${userId}/rutina/activa`);

  return result;
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

export async function getRoutineExerciseReplacementOptions(detailId: number): Promise<{
  success: true;
  data: {
    context: RoutineReplacementContext;
    groups: ExerciseReplacementGroup[];
  };
}> {
  const { adminClient } = await requireAdminAccess();

  const { data: detailRow, error: detailError } = await adminClient
    .from("routine_details")
    .select("*, routines!inner(id, user_id, status)")
    .eq("id", detailId)
    .single();

  if (detailError || !detailRow) {
    throw new Error("No se encontró el detalle de rutina.");
  }

  const routine = Array.isArray(detailRow.routines) ? detailRow.routines[0] : detailRow.routines;
  if (!routine?.user_id || routine.status !== "draft") {
    throw new Error("Solo puedes revisar sugerencias en una rutina en borrador.");
  }

  const detail = mapRoutineDetailRow(detailRow as Record<string, unknown>);
  const [trainingProfile, catalog] = await Promise.all([
    fetchTrainingProfileInternal(adminClient, routine.user_id),
    listExerciseCatalog(adminClient),
  ]);

  const currentExercise =
    detail.exercise_id && Number.isFinite(detail.exercise_id)
      ? catalog.find((exercise) => exercise.id === detail.exercise_id) || null
      : null;

  const replacement = buildExerciseReplacementGroups({
    catalog,
    detail,
    currentExercise,
    trainingProfile,
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
  const { adminClient } = await requireAdminAccess();
  const catalog = await listExerciseCatalog(adminClient);

  return {
    success: true,
    data: searchExerciseCatalogItems(catalog, filters),
  };
}

export async function searchExerciseProvider(
  input: string | { query: string; limit?: number; offset?: number },
) {
  const query = typeof input === "string" ? input : input.query;
  const limit = typeof input === "string" ? undefined : input.limit;
  const offset = typeof input === "string" ? undefined : input.offset;
  const result = await callExerciseCatalogFunction({
    operation: "search",
    query,
    limit,
    offset,
    searchVariants: buildExerciseSearchVariants(query),
  });

  const summaries = (Array.isArray(result?.data) ? result.data : []).map((item: Record<string, unknown>) => ({
    exerciseId:
      typeof item?.exerciseId === "string" ? item.exerciseId : typeof item?.id === "string" ? item.id : "",
    name: typeof item?.name === "string" ? item.name : "Exercise",
    imageUrl:
      typeof item?.imageUrl === "string"
        ? item.imageUrl
        : typeof item?.gifUrl === "string"
          ? item.gifUrl
          : null,
  })) as ProviderExerciseSummary[];

  return {
    success: true,
    data: await hydrateProviderExerciseSummaries(summaries),
    hasMore: result?.hasMore === true,
    nextOffset: typeof result?.nextOffset === "number" ? result.nextOffset : null,
    limit: typeof result?.limit === "number" ? result.limit : clampProviderSearchLimit(limit),
    offset: typeof result?.offset === "number" ? result.offset : clampProviderSearchOffset(offset),
  };
}

export async function importExerciseFromProvider(rawExercise: Record<string, unknown>) {
  const { adminClient } = await requireAdminAccess();

  const providerResult = await callExerciseCatalogFunction({
    operation: "import",
    exercise: rawExercise,
  });

  const normalizedProviderExercise = await resolveProviderExercisePayloadMedia(
    ((providerResult?.data as Record<string, unknown>) || rawExercise) as Record<string, unknown>,
  );
  const payload = mapProviderExerciseToCatalogPayload(normalizedProviderExercise);
  const { data, error } = await adminClient
    .from("exercises")
    .upsert(payload, { onConflict: "slug" })
    .select(
      "id, slug, name, display_name, display_name_es, provider, provider_item_id, is_favorite, is_preview_hidden, body_parts, target_muscles, secondary_muscles, equipments, exercise_type, instructions, tips, keywords, variations, image_url, video_url, description, raw_payload, last_synced_at, is_active",
    )
    .single();

  if (error) throw error;

  return {
    success: true,
    data: normalizeExerciseCatalogItem(data as Record<string, unknown>),
  };
}

export async function seedExerciseCatalog() {
  const { adminClient } = await requireAdminAccess();
  const keywords = [
    "chest",
    "back",
    "shoulder",
    "leg",
    "glute",
    "core",
    "cardio",
    "dumbbell",
    "barbell",
    "machine",
    "band",
    "body weight",
  ];
  const importedExerciseIds = new Set<string>();
  const failedKeywords: string[] = [];
  const errors: string[] = [];

  for (const keyword of keywords) {
    try {
      const searchResult = await callExerciseCatalogFunction({
        operation: "search",
        query: keyword,
      });

      const items = Array.isArray(searchResult?.data) ? searchResult.data.slice(0, 5) : [];

      if (items.length === 0) {
        failedKeywords.push(keyword);
        errors.push(`No se encontraron ejercicios para "${keyword}".`);
        continue;
      }

      for (const item of items) {
        const exerciseId = typeof item?.exerciseId === "string" ? item.exerciseId : "";
        if (!exerciseId || importedExerciseIds.has(exerciseId)) continue;

        const providerResult = await callExerciseCatalogFunction({
          operation: "import",
          exercise: item,
        });

        const rawExercise = (providerResult?.data as Record<string, unknown>) || item;
        const payload = mapProviderExerciseToCatalogPayload(rawExercise);

        const { error } = await adminClient
          .from("exercises")
          .upsert(payload, { onConflict: "slug" });

        if (error) {
          throw error;
        }

        importedExerciseIds.add(exerciseId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error(`Error al sembrar categoría ${keyword}:`, error);
      failedKeywords.push(keyword);
      errors.push(`"${keyword}": ${message}`);
    }
  }

  revalidatePath("/panel/ejercicios");

  const importedCount = importedExerciseIds.size;
  const success = errors.length === 0;

  if (importedCount === 0 && errors.length > 0) {
    return {
      success: false,
      importedCount,
      failedKeywords,
      errors,
      message: "No se pudo importar el catálogo inicial.",
    };
  }

  return {
    success,
    importedCount,
    failedKeywords,
    errors,
    message: success
      ? `Catálogo inicial importado exitosamente (${importedCount} ejercicios).`
      : `Importación parcial completada (${importedCount} ejercicios).`,
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
      mappedDetails = await hydrateRoutineDetailVisuals(mappedDetails, await listExerciseCatalog(adminClient));
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

export async function getCurrentUserRoutineWorkspace(): Promise<CustomerRoutineWorkspace> {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !access.userId) {
    throw new Error("No autorizado");
  }

  return getRoutineWorkspaceForUser(createAdminClient(), access.userId);
}
