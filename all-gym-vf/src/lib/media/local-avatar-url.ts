export function localAvatarUrl(value: string | Blob | undefined): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return undefined;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return undefined;

  try {
    const url = new URL(value, "http://allgym.local");
    return url.origin === "http://allgym.local" ? value : undefined;
  } catch {
    return undefined;
  }
}
