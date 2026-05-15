/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_RAPIDAPI_HOST = "exercisedb.p.rapidapi.com";

interface ProviderRequestBody {
  operation?: "search" | "import" | "refresh";
  query?: string;
  offset?: number;
  limit?: number;
  searchVariants?: string[];
  exerciseId?: string;
  exercise?: Record<string, unknown> | null;
}

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

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function getAdminClient(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") || "";

  if (!supabaseUrl || !serviceKey || !anonKey) {
    throw new Error("Falta configurar las credenciales de Supabase.");
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    throw new Error("No autenticado");
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") {
    throw new Error("No autorizado");
  }

  return supabaseAdmin;
}

function getProviderConfig() {
  const rapidApiKey = Deno.env.get("EXERCISEDB_RAPIDAPI_KEY") ?? "";
  const rapidApiHost = DEFAULT_RAPIDAPI_HOST;

  if (!rapidApiKey) {
    throw new Error("Falta EXERCISEDB_RAPIDAPI_KEY en los secretos de Supabase.");
  }

  return {
    rapidApiKey,
    rapidApiHost,
    baseUrl: `https://${rapidApiHost}`,
  };
}

async function fetchExerciseDb(path: string, searchParams?: Record<string, string | undefined>) {
  const { rapidApiHost, rapidApiKey, baseUrl } = getProviderConfig();
  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value && value.trim()) {
      url.searchParams.set(key, value.trim());
    }
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": rapidApiKey,
      "X-RapidAPI-Host": rapidApiHost,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage =
      payload?.error?.message || payload?.message || payload?.error || `ExerciseDB request failed with ${response.status}`;
    throw new Error(providerMessage);
  }

  return payload;
}

function normalizeSummary(item: Record<string, unknown>) {
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

function normalizeDetail(item: Record<string, unknown>) {
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

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
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

function buildSearchPaths(query: string, variants: string[] = []) {
  const normalizedVariants = uniqueStrings([query, ...variants]).slice(0, 8);
  const paths: string[] = [];

  const addPath = (path: string) => {
    if (!paths.includes(path)) {
      paths.push(path);
    }
  };

  for (const variant of normalizedVariants) {
    addPath(`/exercises/name/${encodeURIComponent(variant)}`);
  }

  for (const variant of normalizedVariants) {
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

async function searchByPath(
  path: string,
  merged: Map<string, ReturnType<typeof normalizeSummary>>,
  searchParams?: Record<string, string | undefined>,
) {
  try {
    const payload = await fetchExerciseDb(path, searchParams);
    let added = 0;

    for (const item of Array.isArray(payload) ? payload : []) {
      const normalized = normalizeSummary((item || {}) as Record<string, unknown>);
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

async function handleSearch(params: { query: string; offset?: unknown; limit?: unknown; searchVariants?: string[] }) {
  const trimmedQuery = params.query.trim();
  const offset = clampProviderSearchOffset(params.offset);
  const limit = clampProviderSearchLimit(params.limit);
  if (!trimmedQuery) {
    return {
      success: true,
      data: [],
      offset,
      limit,
      hasMore: false,
      nextOffset: null,
    };
  }

  const merged = new Map<string, ReturnType<typeof normalizeSummary>>();
  const searchPaths = buildSearchPaths(trimmedQuery, Array.isArray(params.searchVariants) ? params.searchVariants : []);
  const requiredCount = offset + limit + 1;
  const chunkSize = Math.max(limit, EXERCISE_PROVIDER_SEARCH_DEFAULT_LIMIT);
  let exhausted = false;

  for (let round = 0; round < EXERCISE_PROVIDER_SEARCH_MAX_ROUNDS && merged.size < requiredCount; round += 1) {
    const roundOffset = round * chunkSize;
    let addedThisRound = 0;

    for (const path of searchPaths) {
      addedThisRound += await searchByPath(path, merged, {
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
  const data = items.slice(offset, offset + limit);
  const hasMore = items.length > offset + limit || (!exhausted && data.length === limit);

  return {
    success: true,
    data,
    offset,
    limit,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  };
}

function resolveExerciseId(body: ProviderRequestBody) {
  if (typeof body.exerciseId === "string" && body.exerciseId.trim()) {
    return body.exerciseId.trim();
  }

  const nestedExerciseId =
    typeof body.exercise?.exerciseId === "string"
      ? body.exercise.exerciseId
      : typeof body.exercise?.id === "string"
        ? body.exercise.id
      : typeof body.exercise?.provider_item_id === "string"
        ? body.exercise.provider_item_id
        : null;

  return nestedExerciseId?.trim() || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getAdminClient(req);

    const body = (await req.json().catch(() => ({}))) as ProviderRequestBody;
    const operation = body.operation;

    if (!operation) {
      return jsonResponse(400, { error: "operation es obligatorio" });
    }

    if (operation === "search") {
      const result = await handleSearch({
        query: body.query || "",
        offset: body.offset,
        limit: body.limit,
        searchVariants: body.searchVariants,
      });
      return jsonResponse(200, result);
    }

    const exerciseId = resolveExerciseId(body);
    if (!exerciseId) {
      return jsonResponse(400, { error: "exerciseId es obligatorio para importar o refrescar." });
    }

    const payload = await fetchExerciseDb(`/exercises/exercise/${exerciseId}`);
    return jsonResponse(200, { success: true, data: normalizeDetail((payload || {}) as Record<string, unknown>) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    const status = message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500;
    return jsonResponse(status, { error: message });
  }
});
