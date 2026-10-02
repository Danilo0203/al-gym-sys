import type { ExerciseCatalogItem } from "@/lib/training/types";

const localExerciseImagePattern = /^\/api\/media\/exercises\/[a-f0-9]{64}\.(png|jpg|webp|gif)$/;

export function isExerciseMediaStoredLocally(url: unknown): url is string {
  return typeof url === "string" && localExerciseImagePattern.test(url);
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
