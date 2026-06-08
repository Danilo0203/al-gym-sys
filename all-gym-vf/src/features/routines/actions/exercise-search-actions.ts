"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { normalizeExerciseCatalogItem, mapProviderExerciseToCatalogPayload } from "@/lib/training/catalog";
import {
  hydrateExerciseCatalogItem,
  hydrateExerciseCatalogMedia,
  hydrateProviderExerciseSummaries,
  resolveProviderExercisePayloadMedia,
} from "@/lib/training/exercise-media";
import {
  buildExerciseSearchVariants,
  searchExerciseCatalogItems,
} from "@/lib/training/exercise-recommendations";
import type {
  ExerciseCatalogItem,
  ProviderExerciseSummary,
} from "@/lib/training/types";

const EXERCISE_CATALOG_FUNCTION = "exercise-catalog-provider";
const EXERCISEDB_DIRECT_HOST = "exercisedb.p.rapidapi.com";
const EXERCISE_PROVIDER_SEARCH_DEFAULT_LIMIT = 12;
const EXERCISE_PROVIDER_SEARCH_MAX_LIMIT = 24;
const EXERCISE_PROVIDER_SEARCH_MAX_ROUNDS = 8;
const EXERCISE_PROVIDER_TARGET_TERMS = new Set([
  "abductors", "abs", "adductors", "biceps", "calf", "calves", "core",
  "forearms", "glute", "glutes", "hamstrings", "lats", "lower back",
  "pectorals", "quads", "quadriceps", "shoulders", "traps", "triceps",
]);
const EXERCISE_PROVIDER_BODY_PART_TERMS = new Set([
  "back", "cardio", "chest", "lower arms", "lower legs", "neck", "shoulders",
  "upper arms", "upper legs", "waist",
]);
const EXERCISE_PROVIDER_EQUIPMENT_TERMS = new Set([
  "assisted", "band", "barbell", "body weight", "bosu ball", "cable",
  "dumbbell", "elliptical machine", "ez barbell", "hammer", "kettlebell",
  "leverage machine", "medicine ball", "olympic barbell", "resistance band",
  "roller", "rope", "skierg machine", "sled machine", "smith machine",
  "stability ball", "stationary bike", "stepmill machine", "tire", "trap bar",
  "upper body ergometer", "weighted", "wheel roller",
]);

async function requireRoutinesAccess() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !hasPermission(access, "routines.view")) {
    throw new Error("No autorizado");
  }
  return { adminClient: createAdminClient(), access };
}

async function listExerciseCatalog(
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<ExerciseCatalogItem[]> {
  const { data, error } = await adminClient
    .from("exercises")
    .select(
      "id, slug, name, display_name, display_name_es, provider, provider_item_id, is_favorite, is_preview_hidden, body_parts, target_muscles, secondary_muscles, equipments, exercise_type, instructions, tips, keywords, variations, image_url, video_url, description, raw_payload, last_synced_at, is_active",
    )
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) throw error;
  return hydrateExerciseCatalogMedia((data || []).map((row) => normalizeExerciseCatalogItem(row as Record<string, unknown>)));
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
  const ex = exercise as Record<string, unknown>;
  if (typeof ex.exerciseId === "string" && ex.exerciseId.trim()) return ex.exerciseId.trim();
  if (typeof ex.id === "string" && ex.id.trim()) return ex.id.trim();
  if (typeof ex.provider_item_id === "string" && ex.provider_item_id.trim()) return ex.provider_item_id.trim();
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
    return 0;
  }
}

function clampLimit(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return EXERCISE_PROVIDER_SEARCH_DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(num), 1), EXERCISE_PROVIDER_SEARCH_MAX_LIMIT);
}

function clampOffset(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.trunc(num));
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => v?.trim()).filter(Boolean) as string[]));
}

function buildProviderSearchPaths(query: string, rawVariants?: unknown) {
  const variantsFromBody = Array.isArray(rawVariants)
    ? rawVariants.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
  const variants = uniqueStrings([query, ...variantsFromBody, ...buildExerciseSearchVariants(query)]).slice(0, 8);
  const paths: string[] = [];
  const addPath = (p: string) => { if (!paths.includes(p)) paths.push(p); };
  for (const variant of variants) {
    addPath(`/exercises/name/${encodeURIComponent(variant)}`);
  }
  for (const variant of variants) {
    if (EXERCISE_PROVIDER_TARGET_TERMS.has(variant)) addPath(`/exercises/target/${encodeURIComponent(variant)}`);
    if (EXERCISE_PROVIDER_BODY_PART_TERMS.has(variant)) addPath(`/exercises/bodyPart/${encodeURIComponent(variant)}`);
    if (EXERCISE_PROVIDER_EQUIPMENT_TERMS.has(variant)) addPath(`/exercises/equipment/${encodeURIComponent(variant)}`);
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
  const limit = clampLimit(params.limit);
  const offset = clampOffset(params.offset);
  if (!query) {
    return { success: true as const, data: [] as ProviderExerciseSummary[], offset, limit, hasMore: false, nextOffset: null as number | null };
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
      addedThisRound += await searchProviderDirectByPath(path, merged, { limit: String(chunkSize), offset: String(roundOffset) });
      if (merged.size >= requiredCount) break;
    }
    if (addedThisRound === 0) { exhausted = true; break; }
  }

  const items = Array.from(merged.values());
  const data = items.slice(offset, offset + limit) as ProviderExerciseSummary[];
  const hasMore = items.length > offset + limit || (!exhausted && data.length === limit);
  return { success: true as const, data, offset, limit, hasMore, nextOffset: hasMore ? offset + limit : null };
}

async function callExerciseCatalogFunction(body: Record<string, unknown>) {
  await requireRoutinesAccess();

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
    if (!exerciseId) throw new Error("exerciseId es obligatorio para importar o refrescar.");
    const payload = await fetchExerciseProviderDirect(`/exercises/exercise/${exerciseId}`);
    return { success: true, data: normalizeDirectProviderDetail((payload || {}) as Record<string, unknown>) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke(EXERCISE_CATALOG_FUNCTION, { body });
  if (error) throw new Error(error.message || "No se pudo conectar con ExerciseDB.");
  return data;
}

export async function searchExerciseCatalog(filters: {
  query?: string;
  bodyPart?: string;
  targetMuscle?: string;
  equipment?: string;
  limit?: number;
}) {
  const { adminClient } = await requireRoutinesAccess();
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
    exerciseId: typeof item?.exerciseId === "string" ? item.exerciseId : typeof item?.id === "string" ? item.id : "",
    name: typeof item?.name === "string" ? item.name : "Exercise",
    imageUrl: typeof item?.imageUrl === "string" ? item.imageUrl : typeof item?.gifUrl === "string" ? item.gifUrl : null,
  })) as ProviderExerciseSummary[];

  return {
    success: true,
    data: await hydrateProviderExerciseSummaries(summaries),
    hasMore: result?.hasMore === true,
    nextOffset: typeof result?.nextOffset === "number" ? result.nextOffset : null,
    limit: typeof result?.limit === "number" ? result.limit : clampLimit(limit),
    offset: typeof result?.offset === "number" ? result.offset : clampOffset(offset),
  };
}

export async function importExerciseFromProvider(rawExercise: Record<string, unknown>) {
  const { adminClient } = await requireRoutinesAccess();

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
    data: await hydrateExerciseCatalogItem(normalizeExerciseCatalogItem(data as Record<string, unknown>)),
  };
}
