"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { revalidatePath } from "next/cache";

export interface RoleData {
  id: string;
  slug: string;
  name: string;
  scope: "panel" | "client";
  is_system: boolean;
  is_protected: boolean;
  created_at: string;
  updated_at: string;
  user_count?: number;
}

export interface PermissionData {
  id: string;
  key: string;
  description: string | null;
  module: string;
  action: string;
}

type AuthUserRecord = {
  id: string;
  created_at: string;
  raw_user_meta_data?: Record<string, unknown> | null;
};

async function listAllAuthUsers(adminClient: ReturnType<typeof createAdminClient>): Promise<AuthUserRecord[]> {
  const perPage = 1000;
  const users: AuthUserRecord[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(error.message);
    }

    const pageUsers = (data.users ?? []) as AuthUserRecord[];
    users.push(...pageUsers);

    if (pageUsers.length < perPage) break;
    page += 1;
  }

  return users;
}

function resolveRoleSlug(profileRole: string | null | undefined, authRole: unknown): string {
  if (profileRole) return profileRole;
  return typeof authRole === "string" && authRole.trim() ? authRole : "client";
}

export async function getRoles(): Promise<{ success: boolean; data?: RoleData[]; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "roles.view")) {
      return { success: false, error: "No autorizado" };
    }

    const adminClient = createAdminClient();

    const { data: roles, error } = await adminClient
      .from("roles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };

    const [profilesResult, authUsers] = await Promise.all([
      adminClient.from("profiles").select("id, role"),
      listAllAuthUsers(adminClient),
    ]);

    if (profilesResult.error) return { success: false, error: profilesResult.error.message };

    const profileRoleMap = new Map<string, string | null>(
      (profilesResult.data ?? []).map((profile) => [profile.id, profile.role as string | null]),
    );

    const countMap = new Map<string, number>();
    for (const authUser of authUsers) {
      const profileRole = profileRoleMap.get(authUser.id);
      const authRole = authUser.raw_user_meta_data?.role;
      const role = resolveRoleSlug(profileRole, authRole);
      countMap.set(role, (countMap.get(role) || 0) + 1);
    }

    const rolesWithCounts = (roles ?? []).map((r) => ({
      ...r,
      user_count: countMap.get(r.slug) || 0,
    }));

    return { success: true, data: rolesWithCounts as RoleData[] };
  } catch {
    return { success: false, error: "Error al obtener roles" };
  }
}

export async function getPermissions(): Promise<{ success: boolean; data?: PermissionData[]; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("permissions")
      .select("*")
      .order("module", { ascending: true })
      .order("action", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as PermissionData[] };
  } catch {
    return { success: false, error: "Error al obtener permisos" };
  }
}

export async function getRolePermissions(roleId: string): Promise<{ success: boolean; data?: string[]; error?: string }> {
  try {
    const adminClient = createAdminClient();
    // Get permission IDs assigned to the role
    const { data: rolePerms, error: rpError } = await adminClient
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);

    if (rpError) return { success: false, error: rpError.message };

    const permIds = (rolePerms ?? []).map((rp) => rp.permission_id as string);
    return { success: true, data: permIds };
  } catch {
    return { success: false, error: "Error al obtener permisos del rol" };
  }
}

export async function createRole(data: {
  name: string;
  slug: string;
  permissionIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "roles.create")) {
      return { success: false, error: "No autorizado" };
    }

    const adminClient = createAdminClient();

    // Create role
    const { data: role, error: roleError } = await adminClient
      .from("roles")
      .insert({
        name: data.name,
        slug: data.slug,
        scope: "panel",
        is_system: false,
        is_protected: false,
      })
      .select("id")
      .single();

    if (roleError) return { success: false, error: roleError.message };

    // Assign permissions
    if (data.permissionIds.length > 0) {
      const rows = data.permissionIds.map((pid) => ({
        role_id: role.id,
        permission_id: pid,
      }));

      const { error: permError } = await adminClient
        .from("role_permissions")
        .insert(rows);

      if (permError) return { success: false, error: permError.message };
    }

    revalidatePath("/panel/roles");
    return { success: true };
  } catch {
    return { success: false, error: "Error al crear rol" };
  }
}

export async function updateRole(data: {
  id: string;
  name?: string;
  permissionIds?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "roles.update")) {
      return { success: false, error: "No autorizado" };
    }

    const adminClient = createAdminClient();

    // Check if role is protected (owner)
    const { data: existing } = await adminClient
      .from("roles")
      .select("is_protected")
      .eq("id", data.id)
      .single();

    if (existing?.is_protected && !access.isOwner) {
      return { success: false, error: "No se puede editar un rol protegido" };
    }

    if (data.name) {
      const { error: nameError } = await adminClient
        .from("roles")
        .update({ name: data.name })
        .eq("id", data.id);

      if (nameError) return { success: false, error: nameError.message };
    }

    if (data.permissionIds !== undefined) {
      // Remove existing permissions
      await adminClient
        .from("role_permissions")
        .delete()
        .eq("role_id", data.id);

      // Insert new permissions
      if (data.permissionIds.length > 0) {
        const rows = data.permissionIds.map((pid) => ({
          role_id: data.id,
          permission_id: pid,
        }));

        const { error: permError } = await adminClient
          .from("role_permissions")
          .insert(rows);

        if (permError) return { success: false, error: permError.message };
      }
    }

    revalidatePath("/panel/roles");
    return { success: true };
  } catch {
    return { success: false, error: "Error al actualizar rol" };
  }
}

export async function deleteRole(data: {
  id: string;
  replacementRoleSlug?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "roles.delete")) {
      return { success: false, error: "No autorizado" };
    }

    const adminClient = createAdminClient();

    // Check if role is protected
    const { data: existing } = await adminClient
      .from("roles")
      .select("is_protected, slug")
      .eq("id", data.id)
      .single();

    if (!existing) return { success: false, error: "Rol no encontrado" };
    if (existing.is_protected) {
      return { success: false, error: "No se puede eliminar un rol protegido" };
    }

    const [profilesResult, authUsers] = await Promise.all([
      adminClient.from("profiles").select("id, role"),
      listAllAuthUsers(adminClient),
    ]);

    if (profilesResult.error) return { success: false, error: profilesResult.error.message };

    const profileRoleMap = new Map<string, string | null>(
      (profilesResult.data ?? []).map((profile) => [profile.id, profile.role as string | null]),
    );

    const affectedUsers = authUsers.filter((authUser) => {
      const profileRole = profileRoleMap.get(authUser.id);
      const authRole = authUser.raw_user_meta_data?.role;
      return resolveRoleSlug(profileRole, authRole) === existing.slug;
    });

    if (affectedUsers.length > 0) {
      if (!data.replacementRoleSlug) {
        return {
          success: false,
          error: "REASSIGN_REQUIRED",
        };
      }

      // Reassign users using the same source-of-truth logic as the listing.
      for (const user of affectedUsers) {
        const { error: profileError } = await adminClient
          .from("profiles")
          .update({ role: data.replacementRoleSlug })
          .eq("id", user.id);

        if (profileError) return { success: false, error: profileError.message };

        const { error: authError } = await adminClient.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...(user.raw_user_meta_data ?? {}),
            role: data.replacementRoleSlug,
          },
        });

        if (authError) return { success: false, error: authError.message };
      }
    }

    // Delete role (cascades to role_permissions)
    const { error } = await adminClient
      .from("roles")
      .delete()
      .eq("id", data.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/panel/roles");
    return { success: true };
  } catch {
    return { success: false, error: "Error al eliminar rol" };
  }
}
