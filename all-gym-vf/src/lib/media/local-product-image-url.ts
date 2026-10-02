const localProductImagePattern = /^\/api\/media\/products\/[a-f0-9]{64}\.(png|jpg|webp|gif)$/;

export function localProductImageUrl(value: unknown): string | null {
  return typeof value === "string" && localProductImagePattern.test(value) ? value : null;
}
