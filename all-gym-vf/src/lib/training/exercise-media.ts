import type { ExerciseCatalogItem, ProviderExerciseSummary } from "@/lib/training/types";

const localExerciseImagePattern = /^\/api\/media\/exercises\/[a-f0-9]{64}\.(png|jpg|webp|gif)$/;

export function isExerciseMediaStoredLocally(url: string | null | undefined) {
  return typeof url === "string" && localExerciseImagePattern.test(url);
}

export function isLegacyExerciseDbImageUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    return new URL(url).hostname === "v2.exercisedb.io";
  } catch {
    return false;
  }
}

export async function resolveExerciseImageUrl(input: {
  imageUrl?: string | null;
  name?: string | null;
  fallbackQueries?: Array<string | null | undefined>;
}) {
  return isExerciseMediaStoredLocally(input.imageUrl) ? input.imageUrl!.trim() : null;
}

export async function hydrateExerciseCatalogMedia(exercises: ExerciseCatalogItem[]) {
  return exercises.map((exercise) => ({
    ...exercise,
    image_url: isExerciseMediaStoredLocally(exercise.image_url) ? exercise.image_url : null,
    video_url: null,
  }));
}

export async function hydrateExerciseCatalogItem(exercise: ExerciseCatalogItem) {
  const [item] = await hydrateExerciseCatalogMedia([exercise]);
  return item!;
}

export async function hydrateProviderExerciseSummaries(exercises: ProviderExerciseSummary[]) {
  return exercises.map((exercise) => ({
    ...exercise,
    imageUrl: isExerciseMediaStoredLocally(exercise.imageUrl) ? exercise.imageUrl : null,
  }));
}

export async function resolveProviderExercisePayloadMedia<T extends Record<string, unknown>>(exercise: T) {
  const imageUrl = typeof exercise.imageUrl === "string" && isExerciseMediaStoredLocally(exercise.imageUrl)
    ? exercise.imageUrl
    : null;
  return { ...exercise, imageUrl, gifUrl: imageUrl };
}
