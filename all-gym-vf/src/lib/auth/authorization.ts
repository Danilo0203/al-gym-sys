import { UserRole } from "@/types";
import { parseUserRole } from "@/lib/auth/role-utils";
import { getServerAuthContext } from "@/lib/auth/server-auth";
import type { AuthContext } from "@/lib/auth/contracts";

export interface UserAccessContext {
  isAuthenticated: boolean;
  isAdmin: boolean;
  role: UserRole | null;
  userId: string | null;
  roleSlug: string | null;
  roleScope: "panel" | "client" | null;
  permissions: string[];
  isOwner: boolean;
}

export function hasPermission(access: UserAccessContext, permission: string): boolean {
  if (access.isOwner) return true;
  return access.permissions.includes(permission);
}

export function requirePermission(access: UserAccessContext, permission: string): void {
  if (!hasPermission(access, permission)) {
    throw new Error(`Permiso denegado: ${permission}`);
  }
}

function unauthenticatedAccessContext(): UserAccessContext {
  return {
    isAuthenticated: false,
    isAdmin: false,
    role: null,
    userId: null,
    roleSlug: null,
    roleScope: null,
    permissions: [],
    isOwner: false,
  };
}

export function toUserAccessContext(context: AuthContext | null): UserAccessContext {
  if (!context) {
    return unauthenticatedAccessContext();
  }

  const roleSlug = context.authorization.roleSlug;
  const role = parseUserRole(roleSlug);
  const isOwner = context.authorization.isOwner;

  return {
    isAuthenticated: true,
    isAdmin: isOwner || role === "admin",
    role,
    userId: context.user.id,
    roleSlug,
    roleScope: context.authorization.scope,
    permissions: context.authorization.permissions,
    isOwner,
  };
}

export async function getUserAccessContext(): Promise<UserAccessContext> {
  const context = await getServerAuthContext();
  return toUserAccessContext(context);
}
