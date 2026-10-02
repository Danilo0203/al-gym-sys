import type { ExerciseCatalogItem } from "@/lib/training/types";
import { isExerciseMediaStoredLocally } from "@/lib/training/exercise-media";

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function normalizeExerciseCatalogItem(row: Record<string, unknown>): ExerciseCatalogItem {
  return {
    id: Number(row.id),
    slug: typeof row.slug === "string" ? row.slug : null,
    name: typeof row.name === "string" ? row.name : "",
    display_name: typeof row.display_name === "string" ? row.display_name : null,
    display_name_es: typeof row.display_name_es === "string" ? row.display_name_es : null,
    provider: typeof row.provider === "string" ? row.provider : null,
    provider_item_id: typeof row.provider_item_id === "string" ? row.provider_item_id : null,
    is_favorite: row.is_favorite === true,
    is_preview_hidden: row.is_preview_hidden === true,
    body_parts: normalizeStringArray(row.body_parts),
    target_muscles: normalizeStringArray(row.target_muscles),
    secondary_muscles: normalizeStringArray(row.secondary_muscles),
    equipments: normalizeStringArray(row.equipments),
    exercise_type: typeof row.exercise_type === "string" ? row.exercise_type : null,
    instructions: normalizeStringArray(row.instructions),
    tips: normalizeStringArray(row.tips),
    keywords: normalizeStringArray(row.keywords),
    variations: normalizeStringArray(row.variations),
    image_url: isExerciseMediaStoredLocally(row.image_url)
      ? row.image_url
      : isExerciseMediaStoredLocally(row.animation_url)
        ? row.animation_url
        : null,
    video_url: null,
    description: typeof row.description === "string" ? row.description : null,
    raw_payload: row.raw_payload,
    last_synced_at: typeof row.last_synced_at === "string" ? row.last_synced_at : null,
    is_active: row.is_active !== false,
  };
}
