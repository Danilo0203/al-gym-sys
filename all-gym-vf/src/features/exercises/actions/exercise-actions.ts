"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";

const exerciseNameSchema = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres.")
  .max(120, "El nombre no puede superar los 120 caracteres.");

const manualExerciseMetadataFieldsSchema = z.object({
  exerciseType: z.enum(["strength", "cardio", "mobility", "stretching", "balance"]),
  bodyPart: z.enum(["", "chest", "back", "shoulders", "upper arms", "waist", "upper legs", "lower legs", "cardio", "full body"]),
  targetMuscle: z.enum(["", "pectorals", "lats", "mid back", "delts", "biceps", "triceps", "quadriceps", "hamstrings", "glutes", "calves", "core"]),
  equipment: z.enum(["", "body weight", "dumbbell", "barbell", "kettlebell", "cable", "machine", "resistance band", "treadmill", "stationary bike", "rowing machine"]),
  instructions: z.string().trim().max(2000),
});
const manualExerciseMetadataSchema = manualExerciseMetadataFieldsSchema.refine(
  (value) => value.instructions.split(/\r?\n/).filter((line) => line.trim().length > 0).length <= 20
    && value.instructions.split(/\r?\n/).every((line) => line.trim().length <= 100), {
  message: "Cada instrucción puede tener hasta 100 caracteres.",
});
const optionalExerciseMetadataSchema = manualExerciseMetadataFieldsSchema.partial().refine(
  (value) => value.instructions === undefined || (
    value.instructions.split(/\r?\n/).filter((line) => line.trim().length > 0).length <= 20
    && value.instructions.split(/\r?\n/).every((line) => line.trim().length <= 100)
  ), {
    message: "Cada instrucción puede tener hasta 100 caracteres.",
  });

const updateExerciseSchema = z.object({
  exerciseId: z.number().int().positive("El identificador del ejercicio no es válido."),
  displayName: exerciseNameSchema,
  metadata: optionalExerciseMetadataSchema.optional(),
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

interface ExerciseCatalogMutationResult {
  success: boolean;
  message?: string;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

async function getLocalHeaders() {
  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  return cookieHeader ? { cookie: cookieHeader } : undefined;
}

async function fileToProcessedImageBuffer(uploadedFile: File) {
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

    return outputBuffer;
  } catch (error) {
    console.error("Error processing exercise image:", error);
    throw new Error("No se pudo procesar la imagen seleccionada.");
  }
}

async function uploadExerciseImage(uploadedFile: File) {
  const image = await fileToProcessedImageBuffer(uploadedFile);
  const response = await fetchAuthBackend("/media/exercises", {
    method: "POST",
    headers: { ...(await getLocalHeaders()), "content-type": "image/webp" },
    body: new Uint8Array(image),
  });
  if (!response.ok) throw new Error("No se pudo guardar la imagen en el equipo local.");
  const payload: unknown = await response.json();
  if (!isRecord(payload) || typeof payload.url !== "string") {
    throw new Error("La API local devolvió una imagen inválida.");
  }
  return payload.url;
}

export async function updateExerciseCatalogItem(input: {
  exerciseId: number;
  displayName: string;
  metadata?: Partial<{
    exerciseType: "strength" | "cardio" | "mobility" | "stretching" | "balance";
    bodyPart: string;
    targetMuscle: string;
    equipment: string;
    instructions: string;
  }>;
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

    const nextDisplayName = parsedInput.data.displayName;
    const metadata = parsedInput.data.metadata;
    const response = await fetchAuthBackend(`/exercises/${parsedInput.data.exerciseId}`, {
      method: "PATCH",
      headers: { ...(await getLocalHeaders()), "content-type": "application/json" },
      body: JSON.stringify({
        displayName: nextDisplayName,
        ...(metadata?.exerciseType !== undefined ? { exercise_type: metadata.exerciseType } : {}),
        ...(metadata?.bodyPart !== undefined ? { body_parts: metadata.bodyPart ? [metadata.bodyPart] : [] } : {}),
        ...(metadata?.targetMuscle !== undefined ? { target_muscles: metadata.targetMuscle ? [metadata.targetMuscle] : [] } : {}),
        ...(metadata?.equipment !== undefined ? { equipments: metadata.equipment ? [metadata.equipment] : [] } : {}),
        ...(metadata?.instructions !== undefined ? {
          instructions: metadata.instructions.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        } : {}),
      }),
    });
    if (!response.ok) return { success: false, error: "No se pudo actualizar el nombre del ejercicio." };

    revalidatePath("/panel/ejercicios");
    revalidatePath("/panel/clientes");

    return {
      success: true,
      message: "Ejercicio actualizado correctamente.",
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

    const updates: Record<string, boolean> = {};

    if (typeof parsedInput.data.isFavorite === "boolean") {
      updates.is_favorite = parsedInput.data.isFavorite;
    }

    if (typeof parsedInput.data.isPreviewHidden === "boolean") {
      updates.is_preview_hidden = parsedInput.data.isPreviewHidden;
    }

    const response = await fetchAuthBackend(`/exercises/${parsedInput.data.exerciseId}`, {
      method: "PATCH",
      headers: { ...(await getLocalHeaders()), "content-type": "application/json" },
      body: JSON.stringify({
        ...(updates.is_favorite !== undefined ? { isFavorite: updates.is_favorite } : {}),
        ...(updates.is_preview_hidden !== undefined ? { isPreviewHidden: updates.is_preview_hidden } : {}),
      }),
    });

    if (!response.ok) {
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

export async function attachExerciseImage(exerciseId: number, formData: FormData): Promise<ExerciseCatalogMutationResult> {
  try {
    const authError = await ensureAdminAccess("exercises.update");
    if (authError) return { success: false, error: authError };
    if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
      return { success: false, error: "El identificador del ejercicio no es válido." };
    }
    const image = formData.get("image");
    if (!(image instanceof File)) return { success: false, error: "Selecciona una imagen local." };
    const imageUrl = await uploadExerciseImage(image);
    const response = await fetchAuthBackend(`/exercises/${exerciseId}`, {
      method: "PATCH",
      headers: { ...(await getLocalHeaders()), "content-type": "application/json" },
      body: JSON.stringify({ imageUrl, originalFileName: image.name }),
    });
    if (!response.ok) return { success: false, error: "No se pudo vincular la imagen al ejercicio." };

    revalidatePath("/panel/ejercicios");
    revalidatePath("/panel/clientes");
    return { success: true, message: "Imagen local guardada en el ejercicio." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo guardar la imagen." };
  }
}

export async function archiveStarterPackExercises(): Promise<ExerciseCatalogMutationResult> {
  try {
    const authError = await ensureAdminAccess("exercises.update");
    if (authError) {
      return { success: false, error: authError };
    }

    const response = await fetchAuthBackend("/exercises/archive-starter", {
      method: "POST",
      headers: await getLocalHeaders(),
    });

    if (!response.ok) {
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
    const parsedMetadata = manualExerciseMetadataSchema.safeParse({
      exerciseType: formData.get("exerciseType") ?? "strength",
      bodyPart: formData.get("bodyPart") ?? "",
      targetMuscle: formData.get("targetMuscle") ?? "",
      equipment: formData.get("equipment") ?? "",
      instructions: formData.get("instructions") ?? "",
    });

    if (!parsedName.success) {
      return {
        success: false,
        error: parsedName.error.issues[0]?.message || "Ingresa un nombre válido para el ejercicio.",
      };
    }
    if (!parsedMetadata.success) {
      return { success: false, error: parsedMetadata.error.issues[0]?.message || "Los detalles del ejercicio no son válidos." };
    }

    const image = rawImage instanceof File && rawImage.size > 0 ? rawImage : null;
    const imageUrl = image ? await uploadExerciseImage(image) : null;

    const createResponse = await fetchAuthBackend("/exercises", {
      method: "POST",
      headers: { ...(await getLocalHeaders()), "content-type": "application/json" },
      body: JSON.stringify({
        name: parsedName.data,
        ...(imageUrl ? { image_url: imageUrl, original_file_name: image!.name } : {}),
        exercise_type: parsedMetadata.data.exerciseType,
        body_parts: parsedMetadata.data.bodyPart ? [parsedMetadata.data.bodyPart] : [],
        target_muscles: parsedMetadata.data.targetMuscle ? [parsedMetadata.data.targetMuscle] : [],
        equipments: parsedMetadata.data.equipment ? [parsedMetadata.data.equipment] : [],
        instructions: parsedMetadata.data.instructions.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
      }),
    });

    if (!createResponse.ok) {
      return { success: false, error: "No se pudo guardar el ejercicio nuevo." };
    }

    revalidatePath("/panel/ejercicios");

    return {
      success: true,
      message: image ? "Ejercicio e imagen guardados localmente." : "Ejercicio creado sin imagen; puedes agregarla después.",
    };
  } catch (error) {
    console.error("Unexpected error creating exercise catalog item:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error inesperado al crear el ejercicio.",
    };
  }
}
