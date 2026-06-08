import { buildExerciseSearchVariants, normalizeExerciseSearchText } from "@/lib/training/exercise-recommendations";
import type { ExerciseCatalogItem, ProviderExerciseSummary } from "@/lib/training/types";

const EXERCISEDB_PUBLIC_SEARCH_BASE_URL = "https://www.exercisedb.dev";
const EXERCISEDB_PUBLIC_MEDIA_HOST = "static.exercisedb.dev";
const EXERCISEDB_LEGACY_MEDIA_HOST = "v2.exercisedb.io";
const EXERCISEDB_DIRECT_MEDIA_HOST = "exercisedb.p.rapidapi.com";
const EXERCISEDB_PUBLIC_MEDIA_BASE_URL = `https://${EXERCISEDB_PUBLIC_MEDIA_HOST}`;
const PUBLIC_EXERCISE_MEDIA_CACHE = new Map<string, Promise<string | null>>();

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function getExerciseDisplayName(exercise: ExerciseCatalogItem) {
  return exercise.display_name_es || exercise.display_name || exercise.name;
}

function normalizeExerciseMediaUrl(url: string | null | undefined) {
  if (typeof url !== "string") return null;

  const normalizedUrl = url.trim().replace(/^\/\//, "https://");
  if (!normalizedUrl || normalizedUrl === "null" || normalizedUrl === "undefined") {
    return null;
  }

  return normalizedUrl;
}

function isAbsoluteHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function looksLikeRelativeExerciseMediaPath(value: string) {
  if (!value || isAbsoluteHttpUrl(value) || value.startsWith("data:image/")) {
    return false;
  }

  return (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("media/") ||
    value.startsWith("images/") ||
    value.startsWith("exercises/") ||
    /\.(gif|png|jpe?g|webp)(\?.*)?$/i.test(value)
  );
}

function tryParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isExerciseMediaStoredLocally(url: string | null | undefined) {
  const normalizedUrl = normalizeExerciseMediaUrl(url);
  if (!normalizedUrl) return false;

  return (
    normalizedUrl.startsWith("data:image/") ||
    normalizedUrl.includes("/storage/v1/object/public/exercises/")
  );
}

export function isLegacyExerciseDbImageUrl(url: string | null | undefined) {
  const normalizedUrl = normalizeExerciseMediaUrl(url);
  if (!normalizedUrl) return false;

  return tryParseUrl(normalizedUrl)?.hostname === EXERCISEDB_LEGACY_MEDIA_HOST;
}

function isCurrentExerciseDbImageUrl(url: string | null | undefined) {
  const normalizedUrl = normalizeExerciseMediaUrl(url);
  if (!normalizedUrl) return false;

  return tryParseUrl(normalizedUrl)?.hostname === EXERCISEDB_PUBLIC_MEDIA_HOST;
}

function isDirectExerciseDbImageUrl(url: string | null | undefined) {
  const normalizedUrl = normalizeExerciseMediaUrl(url);
  if (!normalizedUrl) return false;

  return tryParseUrl(normalizedUrl)?.hostname === EXERCISEDB_DIRECT_MEDIA_HOST;
}

function normalizePublicExerciseMediaUrl(url: string) {
  const parsed = tryParseUrl(url);
  if (!parsed) return null;

  if (parsed.hostname !== EXERCISEDB_PUBLIC_MEDIA_HOST) {
    return null;
  }

  parsed.protocol = "https:";
  return parsed.toString();
}

function buildCanonicalExerciseDbPublicMediaUrl(url: string | null | undefined) {
  const normalizedUrl = normalizeExerciseMediaUrl(url);
  if (!normalizedUrl) return null;

  if (isCurrentExerciseDbImageUrl(normalizedUrl)) {
    return normalizePublicExerciseMediaUrl(normalizedUrl);
  }

  if (looksLikeRelativeExerciseMediaPath(normalizedUrl)) {
    return new URL(normalizedUrl.replace(/^\.?\/*/, ""), `${EXERCISEDB_PUBLIC_MEDIA_BASE_URL}/`).toString();
  }

  const parsed = tryParseUrl(normalizedUrl);
  if (!parsed) {
    return null;
  }

  if (![EXERCISEDB_LEGACY_MEDIA_HOST, EXERCISEDB_DIRECT_MEDIA_HOST].includes(parsed.hostname)) {
    return null;
  }

  const pathname = parsed.pathname.replace(/^\/+/, "");
  if (!pathname) {
    return null;
  }

  return new URL(pathname, `${EXERCISEDB_PUBLIC_MEDIA_BASE_URL}/`).toString();
}

function selectBestPublicMediaMatch(
  results: Array<{
    name?: string;
    gifUrl?: string;
  }>,
  query: string,
) {
  const normalizedQuery = normalizeExerciseSearchText(query);
  if (!normalizedQuery) return null;

  return (
    results.find((item) => normalizeExerciseSearchText(item.name || "") === normalizedQuery && item.gifUrl?.trim()) ||
    results.find((item) => {
      const normalizedName = normalizeExerciseSearchText(item.name || "");
      return normalizedName.includes(normalizedQuery) && item.gifUrl?.trim();
    }) ||
    results.find((item) => {
      const normalizedName = normalizeExerciseSearchText(item.name || "");
      return normalizedQuery.includes(normalizedName) && item.gifUrl?.trim();
    }) ||
    results.find((item) => item.gifUrl?.trim()) ||
    null
  );
}

async function fetchPublicExerciseMedia(query: string) {
  const cacheKey = normalizeExerciseSearchText(query);
  if (!cacheKey) {
    return null;
  }

  const cached = PUBLIC_EXERCISE_MEDIA_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    const variants = uniqueStrings([query, ...buildExerciseSearchVariants(query)]).slice(0, 8);

    for (const variant of variants) {
      try {
        const url = new URL("/api/v1/exercises/search", EXERCISEDB_PUBLIC_SEARCH_BASE_URL);
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
        const match = selectBestPublicMediaMatch(results, variant);

        if (match?.gifUrl?.trim()) {
          return match.gifUrl.trim();
        }
      } catch {
        continue;
      }
    }

    return null;
  })();

  PUBLIC_EXERCISE_MEDIA_CACHE.set(cacheKey, request);
  return request;
}

export async function resolveExerciseImageUrl(input: {
  imageUrl?: string | null;
  name?: string | null;
  fallbackQueries?: Array<string | null | undefined>;
}) {
  const normalizedUrl = normalizeExerciseMediaUrl(input.imageUrl);
  const fallbackQueries = uniqueStrings([input.name, ...(input.fallbackQueries || [])]);

  if (!normalizedUrl) {
    for (const query of fallbackQueries) {
      const resolvedUrl = await fetchPublicExerciseMedia(query);
      if (resolvedUrl) {
        return resolvedUrl;
      }
    }

    return null;
  }

  if (isExerciseMediaStoredLocally(normalizedUrl) || isCurrentExerciseDbImageUrl(normalizedUrl)) {
    return isCurrentExerciseDbImageUrl(normalizedUrl)
      ? normalizePublicExerciseMediaUrl(normalizedUrl) || normalizedUrl
      : normalizedUrl;
  }

  const needsPublicResolution =
    isLegacyExerciseDbImageUrl(normalizedUrl) ||
    isDirectExerciseDbImageUrl(normalizedUrl) ||
    looksLikeRelativeExerciseMediaPath(normalizedUrl);
  const canonicalExerciseDbUrl = buildCanonicalExerciseDbPublicMediaUrl(normalizedUrl);

  if (!needsPublicResolution) {
    return normalizedUrl;
  }

  for (const query of fallbackQueries) {
    const resolvedUrl = await fetchPublicExerciseMedia(query);
    if (resolvedUrl) {
      return resolvedUrl;
    }
  }

  return canonicalExerciseDbUrl || normalizedUrl;
}

export async function hydrateExerciseCatalogMedia(exercises: ExerciseCatalogItem[]) {
  return Promise.all(
    exercises.map(async (exercise) => {
      const resolvedImageUrl = await resolveExerciseImageUrl({
        imageUrl: exercise.image_url,
        name: getExerciseDisplayName(exercise),
        fallbackQueries: [exercise.name, exercise.slug?.replace(/-/g, " ")],
      });

      if (!resolvedImageUrl || resolvedImageUrl === exercise.image_url) {
        return exercise;
      }

      return {
        ...exercise,
        image_url: resolvedImageUrl,
      };
    }),
  );
}

export async function hydrateExerciseCatalogItem(exercise: ExerciseCatalogItem) {
  const [hydratedExercise] = await hydrateExerciseCatalogMedia([exercise]);
  return hydratedExercise;
}

export async function hydrateProviderExerciseSummaries(exercises: ProviderExerciseSummary[]) {
  return Promise.all(
    exercises.map(async (exercise) => {
      const resolvedImageUrl = await resolveExerciseImageUrl({
        imageUrl: exercise.imageUrl,
        name: exercise.name,
      });

      if (!resolvedImageUrl || resolvedImageUrl === exercise.imageUrl) {
        return exercise;
      }

      return {
        ...exercise,
        imageUrl: resolvedImageUrl,
      };
    }),
  );
}

export async function resolveProviderExercisePayloadMedia<T extends Record<string, unknown>>(exercise: T) {
  const currentImageUrl =
    typeof exercise.imageUrl === "string"
      ? exercise.imageUrl
      : typeof exercise.gifUrl === "string"
        ? exercise.gifUrl
        : null;
  const name = typeof exercise.name === "string" ? exercise.name : null;

  const resolvedImageUrl = await resolveExerciseImageUrl({
    imageUrl: currentImageUrl,
    name,
  });

  if (!resolvedImageUrl || resolvedImageUrl === currentImageUrl) {
    return exercise;
  }

  return {
    ...exercise,
    imageUrl: resolvedImageUrl,
    gifUrl: resolvedImageUrl,
  };
}
