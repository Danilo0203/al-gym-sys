import sharp from "sharp";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function fileToProcessedImageBuffer(uploadedFile: File): Promise<Buffer> {
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
    // No convertir GIF a un WebP de un solo fotograma: conservar su animación original.
    if (uploadedFile.type === "image/gif") return inputBuffer;
    return await sharp(inputBuffer)
      .rotate()
      .resize(720, 720, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (error) {
    console.error("Error processing exercise image:", error);
    throw new Error("No se pudo procesar la imagen seleccionada.");
  }
}
