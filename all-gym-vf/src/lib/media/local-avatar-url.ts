export function localAvatarUrl(value: string | Blob | undefined): string | undefined {
  return typeof value === "string"
    && /^\/api\/media\/avatars\/[a-f0-9]{64}\.(png|jpg|webp|gif)$/.test(value)
    ? value : undefined;
}
