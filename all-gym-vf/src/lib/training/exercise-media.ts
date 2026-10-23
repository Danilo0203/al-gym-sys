import type { ExerciseCatalogItem } from "@/lib/training/types";

const localExerciseImagePattern = /^\/api\/media\/exercises\/[a-f0-9]{64}\.(png|jpg|webp|gif|mp4)$/;

export const EXERCISE_MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,.mp4";
export const MAX_EXERCISE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_EXERCISE_VIDEO_BYTES = 20 * 1024 * 1024;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"]);

export function isExerciseVideoFile(file: Pick<File, "name" | "type">) {
  return file.type === "video/mp4" || (!file.type && /\.mp4$/i.test(file.name));
}

export function getExerciseMediaUploadError(file: Pick<File, "name" | "type" | "size">): string | null {
  if (file.size === 0) return "Selecciona una imagen o un video MP4 para el ejercicio.";
  const video = isExerciseVideoFile(file);
  if (!video && !acceptedTypes.has(file.type)) return "El archivo debe ser JPG, PNG, WEBP, GIF o MP4.";
  if (file.size > (video ? MAX_EXERCISE_VIDEO_BYTES : MAX_EXERCISE_IMAGE_BYTES)) {
    return video ? "El video no puede superar los 20 MB." : "La imagen no puede superar los 5 MB.";
  }
  return null;
}

export function isExerciseVideoUrl(url: string) {
  return isExerciseMediaStoredLocally(url) && url.endsWith(".mp4");
}

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
