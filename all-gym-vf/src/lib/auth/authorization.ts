import { createClient } from "@/lib/supabase/server";
import { UserRole } from "@/types";
import { parseUserRole } from "@/lib/auth/role-utils";
import { isLocalAuthEnabled, LocalApiError, requestLocalApi } from "@/lib/auth/local-auth-server";

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

export async function getUserAccessContext(): Promise<UserAccessContext> {
  if (isLocalAuthEnabled()) {
    try {
      const response = await requestLocalApi<{
        authenticated: boolean;
        user: {
          id: string;
          role: string | null;
          roleScope: "panel" | "client" | null;
          permissions: string[];
          isOwner: boolean;
        } | null;
      }>("/auth/me");

      const user = response?.user;

      if (!response?.authenticated || !user) {
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

      const roleSlug = user.role ?? null;
      const role = parseUserRole(roleSlug);
      const isOwner = Boolean(user.isOwner || roleSlug === "owner");

      return {
        isAuthenticated: true,
        isAdmin: isOwner || role === "admin",
        role,
        userId: user.id,
        roleSlug,
        roleScope: user.roleScope ?? null,
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
        isOwner,
      };
    } catch (error) {
      if (error instanceof LocalApiError && error.status === 401) {
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

      console.error("Error resolving local access context:", error);

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
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const roleSlug = (profile?.role || user.user_metadata?.role || null) as string | null;
  const role = parseUserRole(roleSlug);
  const isOwner = roleSlug === "owner";

  let roleScope: "panel" | "client" | null = null;
  let permissions: string[] = [];

  if (roleSlug) {
    const [{ data: roleData }, { data: perms }] = await Promise.all([
      supabase.from("roles").select("scope").eq("slug", roleSlug).maybeSingle(),
      supabase.rpc("get_current_permissions"),
    ]);

    roleScope = (roleData?.scope as "panel" | "client") || null;
    if (perms) {
      permissions = perms as string[];
    }
  }

  return {
    isAuthenticated: true,
    isAdmin: isOwner || role === "admin",
    role,
    userId: user.id,
    roleSlug: roleSlug || null,
    roleScope,
    permissions,
    isOwner,
  };
}
