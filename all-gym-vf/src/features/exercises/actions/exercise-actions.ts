"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { buildExerciseSlug } from "@/lib/training/catalog";
import { resolveExerciseImageUrl } from "@/lib/training/exercise-media";
import { createAdminClient } from "@/lib/supabase/admin";

const exerciseNameSchema = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres.")
  .max(120, "El nombre no puede superar los 120 caracteres.");

const updateExerciseSchema = z.object({
  exerciseId: z.number().int().positive("El identificador del ejercicio no es válido."),
  displayName: exerciseNameSchema,
});

const updateExercisePreferencesSchema = z
  .object({
    exerciseId: z.number().int().positive("El identificador del ejercicio no es válido."),
    isFavorite: z.boolean().optional(),
    isPreviewHidden: z.boolean().optional(),
  })
  .refine((value) => typeof value.isFavorite === "boolean" || typeof value.isPreviewHidden === "boolean", {
    message: "No se recibieron cambios para actualizar el ejercicio.",
  });

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXERCISE_MEDIA_BUCKET = "exercises";

interface ExerciseCatalogMutationResult {
  success: boolean;
  message?: string;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStoragePublicPrefix() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/${EXERCISE_MEDIA_BUCKET}/`;
}

function isExerciseMediaStoredLocally(url: string | null | undefined) {
  if (!url) return false;
  if (url.startsWith("data:image/")) return true;

  const storagePublicPrefix = getStoragePublicPrefix();
  return storagePublicPrefix ? url.startsWith(storagePublicPrefix) : false;
}

function resolveImageExtension(contentType: string | null, sourceUrl: string) {
  const normalizedType = contentType?.toLowerCase().trim() || "";

  if (normalizedType.includes("gif")) return "gif";
  if (normalizedType.includes("png")) return "png";
  if (normalizedType.includes("jpeg") || normalizedType.includes("jpg")) return "jpg";
  if (normalizedType.includes("webp")) return "webp";

  try {
    const url = new URL(sourceUrl);
    const pathname = url.pathname.toLowerCase();

    if (pathname.endsWith(".gif")) return "gif";
    if (pathname.endsWith(".png")) return "png";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "jpg";
    if (pathname.endsWith(".webp")) return "webp";
  } catch {
    // Ignore malformed URLs and use the default extension below.
  }

  return "gif";
}

async function ensureExerciseMediaBucket(adminClient: ReturnType<typeof createAdminClient>) {
  const { error } = await adminClient.storage.createBucket(EXERCISE_MEDIA_BUCKET, {
    public: true,
    allowedMimeTypes: ["image/*"],
    fileSizeLimit: "15MB",
  });

  if (error && !/already exists|duplicate|exists/i.test(error.message || "")) {
    throw error;
  }
}

async function ensureAdminAccess(permission: string = "exercises.view") {
  const access = await getUserAccessContext();

  if (!access.isAuthenticated) {
    return "No autenticado.";
  }

  if (!hasPermission(access, permission)) {
    return "No autorizado.";
  }

  return null;
}

async function buildUniqueExerciseSlug(adminClient: ReturnType<typeof createAdminClient>, name: string) {
  const baseSlug = buildExerciseSlug({ name }) || "manual-exercise";

  const { data, error } = await adminClient
    .from("exercises")
    .select("slug")
    .like("slug", `${baseSlug}%`);

  if (error) {
    throw error;
  }

  const usedSlugs = new Set(
    (data ?? [])
      .map((row) => (typeof row.slug === "string" ? row.slug : null))
      .filter((slug): slug is string => Boolean(slug)),
  );

  if (!usedSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let nextSuffix = 2;
  while (usedSlugs.has(`${baseSlug}-${nextSuffix}`)) {
    nextSuffix += 1;
  }

  return `${baseSlug}-${nextSuffix}`;
}

async function fileToStoredImageDataUrl(uploadedFile: File) {
  if (!uploadedFile || uploadedFile.size === 0) {
    throw new Error("Selecciona una imagen para el ejercicio.");
  }

  if (!ACCEPTED_IMAGE_TYPES.has(uploadedFile.type)) {
    throw new Error("La imagen debe ser JPG, PNG, WEBP o GIF.");
  }

  if (uploadedFile.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("La imagen no puede superar los 5 MB.");
  }

  try {
    const inputBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const outputBuffer = await sharp(inputBuffer)
      .rotate()
      .resize(720, 720, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();

    return `data:image/webp;base64,${outputBuffer.toString("base64")}`;
  } catch (error) {
    console.error("Error processing exercise image:", error);
    throw new Error("No se pudo procesar la imagen seleccionada.");
  }
}

export async function updateExerciseCatalogItem(input: {
  exerciseId: number;
  displayName: string;
}): Promise<ExerciseCatalogMutationResult> {
  try {
    const authError = await ensureAdminAccess("exercises.update");
    if (authError) {
      return { success: false, error: authError };
    }

    const parsedInput = updateExerciseSchema.safeParse(input);
    if (!parsedInput.success) {
      return {
        success: false,
        error: parsedInput.error.issues[0]?.message || "No se pudo actualizar el ejercicio.",
      };
    }

    const adminClient = createAdminClient();
    const nextDisplayName = parsedInput.data.displayName;
    const [{ error: exerciseError }, { error: routineDetailsError }] = await Promise.all([
      adminClient
        .from("exercises")
        .update({
          name: nextDisplayName,
          display_name: nextDisplayName,
        })
        .eq("id", parsedInput.data.exerciseId),
      adminClient
        .from("routine_details")
        .update({
          exercise_name_snapshot: nextDisplayName,
        })
        .eq("exercise_id", parsedInput.data.exerciseId),
    ]);

    if (exerciseError) {
      console.error("Error updating exercise catalog item:", exerciseError);
      return { success: false, error: "No se pudo actualizar el nombre del ejercicio." };
    }

    if (routineDetailsError) {
      console.error("Error syncing exercise name with routine details:", routineDetailsError);
      return { success: false, error: "El nombre se actualizó, pero no se pudo sincronizar en las rutinas." };
    }

    revalidatePath("/panel/ejercicios");
    revalidatePath("/panel/clientes");

    return {
      success: true,
      message: "Nombre del ejercicio actualizado correctamente.",
    };
  } catch (error) {
    console.error("Unexpected error updating exercise catalog item:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error inesperado al actualizar el ejercicio.",
    };
  }
}

export async function updateExerciseCatalogPreferences(input: {
  exerciseId: number;
  isFavorite?: boolean;
  isPreviewHidden?: boolean;
}): Promise<ExerciseCatalogMutationResult> {
  try {
    const authError = await ensureAdminAccess("exercises.update");
    if (authError) {
      return { success: false, error: authError };
    }

    const parsedInput = updateExercisePreferencesSchema.safeParse(input);
    if (!parsedInput.success) {
      return {
        success: false,
        error: parsedInput.error.issues[0]?.message || "No se pudieron actualizar las preferencias del ejercicio.",
      };
    }

    const adminClient = createAdminClient();
    const updates: Record<string, boolean> = {};

    if (typeof parsedInput.data.isFavorite === "boolean") {
      updates.is_favorite = parsedInput.data.isFavorite;
    }

    if (typeof parsedInput.data.isPreviewHidden === "boolean") {
      updates.is_preview_hidden = parsedInput.data.isPreviewHidden;
    }

    const { error } = await adminClient.from("exercises").update(updates).eq("id", parsedInput.data.exerciseId);

    if (error) {
      console.error("Error updating exercise catalog preferences:", error);
      return { success: false, error: "No se pudieron actualizar las preferencias del ejercicio." };
    }

    revalidatePath("/panel/ejercicios");
    revalidatePath("/panel/clientes");

    return {
      success: true,
      message: "Preferencias del ejercicio actualizadas correctamente.",
    };
  } catch (error) {
    console.error("Unexpected error updating exercise catalog preferences:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error inesperado al actualizar las preferencias del ejercicio.",
    };
  }
}

export async function saveExerciseMediaToLocal(exerciseId: number): Promise<ExerciseCatalogMutationResult> {
  try {
    const authError = await ensureAdminAccess("exercises.update");
    if (authError) {
      return { success: false, error: authError };
    }

    if (!Number.isFinite(exerciseId) || exerciseId <= 0) {
      return { success: false, error: "El identificador del ejercicio no es válido." };
    }

    const adminClient = createAdminClient();
    const { data: exercise, error: exerciseError } = await adminClient
      .from("exercises")
      .select("id, slug, name, provider, provider_item_id, image_url, animation_url, raw_payload")
      .eq("id", exerciseId)
      .single();

    if (exerciseError || !exercise) {
      console.error("Error fetching exercise for local media sync:", exerciseError);
      return { success: false, error: "No se encontró el ejercicio." };
    }

    const currentImageUrl = typeof exercise.image_url === "string" ? exercise.image_url : null;
    if (!currentImageUrl) {
      return { success: false, error: "Este ejercicio no tiene imagen para guardar localmente." };
    }

    if (isExerciseMediaStoredLocally(currentImageUrl)) {
      if (exercise.provider !== "local") {
        const currentPayload = isRecord(exercise.raw_payload) ? exercise.raw_payload : {};
        await adminClient
          .from("exercises")
          .update({
            provider: "local",
            raw_payload: {
              ...currentPayload,
              media_cache: {
                ...(isRecord(currentPayload.media_cache) ? currentPayload.media_cache : {}),
                source_url: currentImageUrl,
                cached_at: new Date().toISOString(),
                bucket: EXERCISE_MEDIA_BUCKET,
                status: "already_local",
              },
            },
          })
          .eq("id", exerciseId);
      }

      revalidatePath("/panel/ejercicios");
      return { success: true, message: "La imagen ya estaba guardada localmente." };
    }

    await ensureExerciseMediaBucket(adminClient);

    const resolvedSourceUrl =
      (await resolveExerciseImageUrl({
        imageUrl: currentImageUrl,
        name: typeof exercise.name === "string" ? exercise.name : null,
        fallbackQueries: [
          typeof exercise.slug === "string" ? exercise.slug.replace(/-/g, " ") : null,
          typeof exercise.provider_item_id === "string" ? exercise.provider_item_id : null,
        ],
      })) || currentImageUrl;

    const mediaResponse = await fetch(resolvedSourceUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (!mediaResponse.ok) {
      return { success: false, error: "No se pudo descargar la imagen original para guardarla localmente." };
    }

    const mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());
    const contentType = mediaResponse.headers.get("content-type") || "image/gif";
    const fileExtension = resolveImageExtension(contentType, resolvedSourceUrl);
    const fileBaseName =
      (typeof exercise.slug === "string" && exercise.slug.trim()) ||
      (typeof exercise.provider_item_id === "string" && exercise.provider_item_id.trim()) ||
      buildExerciseSlug({ name: exercise.name || `exercise-${exercise.id}` }) ||
      `exercise-${exercise.id}`;
    const storagePath = `catalog/${exercise.id}/${fileBaseName}.${fileExtension}`;

    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from(EXERCISE_MEDIA_BUCKET)
      .upload(storagePath, mediaBuffer, {
        contentType,
        upsert: true,
        cacheControl: "31536000",
      });

    if (uploadError || !uploadData) {
      console.error("Error uploading exercise media to Supabase Storage:", uploadError);
      return { success: false, error: "No se pudo guardar la imagen en Supabase Storage." };
    }

    const { data: publicUrlData } = adminClient.storage.from(EXERCISE_MEDIA_BUCKET).getPublicUrl(uploadData.path);
    const publicUrl = publicUrlData.publicUrl;
    const currentPayload = isRecord(exercise.raw_payload) ? exercise.raw_payload : {};

    const { error: updateError } = await adminClient
      .from("exercises")
      .update({
        provider: "local",
        image_url: publicUrl,
        animation_url: publicUrl,
        raw_payload: {
          ...currentPayload,
          media_cache: {
            source_provider: exercise.provider,
            source_url: resolvedSourceUrl,
            legacy_source_url: currentImageUrl !== resolvedSourceUrl ? currentImageUrl : undefined,
            bucket: EXERCISE_MEDIA_BUCKET,
            path: uploadData.path,
            cached_at: new Date().toISOString(),
            content_type: contentType,
          },
        },
      })
      .eq("id", exerciseId);

    if (updateError) {
      console.error("Error updating exercise after local media sync:", updateError);
      return { success: false, error: "La imagen se guardó, pero no se pudo actualizar el ejercicio." };
    }

    revalidatePath("/panel/ejercicios");
    revalidatePath("/panel/clientes");

    return {
      success: true,
      message: "Imagen guardada localmente en Supabase Storage.",
    };
  } catch (error) {
    console.error("Unexpected error saving exercise media locally:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error inesperado al guardar la imagen localmente.",
    };
  }
}

export async function archiveStarterPackExercises(): Promise<ExerciseCatalogMutationResult> {
  try {
    const authError = await ensureAdminAccess("exercises.update");
    if (authError) {
      return { success: false, error: authError };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("exercises")
      .update({
        is_active: false,
      })
      .eq("provider", "starter_pack")
      .eq("is_active", true);

    if (error) {
      console.error("Error archiving starter pack exercises:", error);
      return { success: false, error: "No se pudieron ocultar los ejercicios iniciales." };
    }

    revalidatePath("/panel/ejercicios");

    return {
      success: true,
      message: "Los ejercicios iniciales se ocultaron del catálogo.",
    };
  } catch (error) {
    console.error("Unexpected error archiving starter pack exercises:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error inesperado al ocultar ejercicios iniciales.",
    };
  }
}

export async function createExerciseCatalogItem(formData: FormData): Promise<ExerciseCatalogMutationResult> {
  try {
    const authError = await ensureAdminAccess("exercises.create");
    if (authError) {
      return { success: false, error: authError };
    }

    const rawName = formData.get("name");
    const rawImage = formData.get("image");
    const parsedName = exerciseNameSchema.safeParse(rawName);

    if (!parsedName.success) {
      return {
        success: false,
        error: parsedName.error.issues[0]?.message || "Ingresa un nombre válido para el ejercicio.",
      };
    }

    if (!(rawImage instanceof File)) {
      return { success: false, error: "Selecciona una imagen para el ejercicio." };
    }

    const imageUrl = await fileToStoredImageDataUrl(rawImage);
    const adminClient = createAdminClient();
    const slug = await buildUniqueExerciseSlug(adminClient, parsedName.data);
    const now = new Date().toISOString();

    const { error } = await adminClient.from("exercises").insert({
      slug,
      name: parsedName.data,
      display_name: parsedName.data,
      display_name_es: null,
      provider: "custom_local",
      provider_item_id: null,
      body_parts: [],
      target_muscles: [],
      secondary_muscles: [],
      equipments: [],
      exercise_type: "custom",
      instructions: [],
      tips: [],
      keywords: [],
      variations: [],
      image_url: imageUrl,
      video_url: null,
      description: null,
      raw_payload: {
        source: "manual_upload",
        uploaded_at: now,
        original_file_name: rawImage.name,
        original_mime_type: rawImage.type,
      },
      last_synced_at: now,
      is_active: true,
    });

    if (error) {
      console.error("Error creating exercise catalog item:", error);
      return { success: false, error: "No se pudo guardar el ejercicio nuevo." };
    }

    revalidatePath("/panel/ejercicios");

    return {
      success: true,
      message: "Ejercicio creado correctamente.",
    };
  } catch (error) {
    console.error("Unexpected error creating exercise catalog item:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error inesperado al crear el ejercicio.",
    };
  }
}
