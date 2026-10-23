import { getExerciseMediaUploadError } from "@/lib/training/exercise-media";

export type ExerciseBatchItem = {
  id: string;
  file: File;
  path: string;
  name: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
};

const mediaTypes: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", gif: "image/gif", mp4: "video/mp4",
};

export function exerciseNameFromFile(filename: string) {
  return filename.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "").trim();
}

export function normalizeExerciseName(name: string) {
  return name.trim().normalize("NFC").toLocaleLowerCase("es");
}

export function prepareExerciseBatch(files: readonly File[]): ExerciseBatchItem[] {
  return files.map((file) => {
    const path = file.webkitRelativePath || (file as File & { path?: string }).path || file.name;
    const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
    // Windows can omit the MIME type when selecting a folder. The server still checks content.
    const uploadFile = !file.type && mediaTypes[extension]
      ? new File([file], file.name, { type: mediaTypes[extension], lastModified: file.lastModified })
      : file;
    return {
      id: crypto.randomUUID(), file: uploadFile, path,
      name: exerciseNameFromFile(file.name), status: "pending",
    };
  });
}

export function validateExerciseBatch(items: readonly ExerciseBatchItem[], existingNames: readonly string[]) {
  const usedNames = new Set(existingNames.map(normalizeExerciseName));
  for (const item of items) {
    if (item.status === "success") usedNames.add(normalizeExerciseName(item.name));
  }
  const errors = new Map<string, string>();
  for (const item of items) {
    if (item.status === "success") continue;
    const name = item.name.trim();
    const error = getExerciseMediaUploadError(item.file)
      || (name.length < 2 || name.length > 120 ? "Usa un nombre de 2 a 120 caracteres." : null)
      || (usedNames.has(normalizeExerciseName(name)) ? "Ya existe un ejercicio con este nombre en el catálogo o en este lote." : null);
    if (error) errors.set(item.id, error);
    else usedNames.add(normalizeExerciseName(name));
  }
  return errors;
}

export async function uploadExerciseBatch(
  items: readonly ExerciseBatchItem[],
  create: (data: FormData) => Promise<{ success: boolean; error?: string }>,
  onChange: (id: string, status: ExerciseBatchItem["status"], error?: string) => void,
  shouldStop: () => boolean,
) {
  let saved = 0;
  let failed = 0;
  // One request per file avoids combining a whole folder into a huge server action.
  for (const item of items) {
    if (shouldStop()) break;
    onChange(item.id, "uploading");
    const data = new FormData();
    data.set("name", item.name.trim());
    data.set("image", item.file);
    try {
      const result = await create(data);
      if (!result.success) throw new Error(result.error || "No se pudo guardar el ejercicio.");
      saved += 1;
      onChange(item.id, "success");
    } catch (error) {
      failed += 1;
      onChange(item.id, "error", error instanceof Error ? error.message : "No se pudo guardar el ejercicio.");
    }
  }
  return { saved, failed };
}
