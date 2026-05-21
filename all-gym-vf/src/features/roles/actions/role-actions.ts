import { requestLocalAdmin } from "@/lib/api/local-admin";

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
  permissionIds?: string[];
}

export interface PermissionData {
  id: string;
  key: string;
  description: string | null;
  module: string;
  action: string;
}

export async function getRoles(): Promise<{ success: boolean; data?: RoleData[]; error?: string }> {
  try {
    const roles = await requestLocalAdmin<RoleData[]>("/api/panel/roles");
    return { success: true, data: roles };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al obtener roles" };
  }
}

export async function getPermissions(): Promise<{ success: boolean; data?: PermissionData[]; error?: string }> {
  try {
    const permissions = await requestLocalAdmin<PermissionData[]>("/api/panel/roles/permissions");
    return { success: true, data: permissions };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al obtener permisos" };
  }
}

export async function getRolePermissions(roleId: string): Promise<{ success: boolean; data?: string[]; error?: string }> {
  try {
    const permissionIds = await requestLocalAdmin<string[]>(`/api/panel/roles/${roleId}/permissions`);
    return { success: true, data: permissionIds };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al obtener permisos del rol" };
  }
}

export async function createRole(data: {
  name: string;
  slug: string;
  permissionIds: string[];
  scope?: "panel" | "client";
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requestLocalAdmin<RoleData>("/api/panel/roles", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        slug: data.slug,
        scope: data.scope ?? "panel",
        permissionIds: data.permissionIds
      })
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al crear rol" };
  }
}

export async function updateRole(data: {
  id: string;
  name?: string;
  permissionIds?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requestLocalAdmin<RoleData>(`/api/panel/roles/${data.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: data.name,
        permissionIds: data.permissionIds
      })
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al actualizar rol" };
  }
}

export async function deleteRole(data: {
  id: string;
  replacementRoleSlug?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requestLocalAdmin<null>(`/api/panel/roles/${data.id}`, {
      method: "DELETE",
      body: JSON.stringify({
        replacementRoleSlug: data.replacementRoleSlug
      })
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al eliminar rol" };
  }
}
