export const PROFILE_EDIT_PERMISSION_KEYS = [
  "profile.edit",
  "profile.update",
  "profiles.edit",
  "profiles.update",
] as const;

export function canEditOwnProfile(permissions: string[], isOwner: boolean): boolean {
  if (isOwner) return true;
  return PROFILE_EDIT_PERMISSION_KEYS.some((permission) => permissions.includes(permission));
}
