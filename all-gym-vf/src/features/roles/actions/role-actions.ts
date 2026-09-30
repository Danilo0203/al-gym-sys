"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";

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

type BackendError = { error?: { code?: string; message?: string } };

async function backendHeaders(): Promise<Headers> {
  const cookieHeader = buildCookieHeader((await cookies()).getAll());
  const headers = new Headers({ "content-type": "application/json" });
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return headers;
}

async function responseError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as BackendError | null;
  return body?.error?.code === "REASSIGN_REQUIRED"
    ? "REASSIGN_REQUIRED"
    : body?.error?.message || fallback;
}

async function canManage(permission: string): Promise<string | null> {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) return "No autenticado";
  if (!hasPermission(access, permission)) return "No autorizado";
  return null;
}

export async function getRoles(): Promise<{ success: boolean; data?: RoleData[]; error?: string }> {
  try {
    const denied = await canManage("roles.view");
    if (denied) return { success: false, error: denied };
    const response = await fetchAuthBackend("/roles", { headers: await backendHeaders() });
    if (!response.ok) return { success: false, error: await responseError(response, "Error al obtener roles") };
    const payload = (await response.json()) as { data: RoleData[] };
    return { success: true, data: payload.data };
  } catch {
    return { success: false, error: "Error de conexión con el backend local" };
  }
}

export async function getPermissions(): Promise<{ success: boolean; data?: PermissionData[]; error?: string }> {
  try {
    const denied = await canManage("roles.view");
    if (denied) return { success: false, error: denied };
    const response = await fetchAuthBackend("/roles/permissions", { headers: await backendHeaders() });
    if (!response.ok) return { success: false, error: await responseError(response, "Error al obtener permisos") };
    const payload = (await response.json()) as { data: PermissionData[] };
    return { success: true, data: payload.data };
  } catch {
    return { success: false, error: "Error de conexión con el backend local" };
  }
}

export async function getRolePermissions(roleId: string): Promise<{ success: boolean; data?: string[]; error?: string }> {
  try {
    const denied = await canManage("roles.view");
    if (denied) return { success: false, error: denied };
    const response = await fetchAuthBackend(`/roles/${encodeURIComponent(roleId)}/permissions`, {
      headers: await backendHeaders(),
    });
    if (!response.ok) return { success: false, error: await responseError(response, "Error al obtener permisos del rol") };
    const payload = (await response.json()) as { data: string[] };
    return { success: true, data: payload.data };
  } catch {
    return { success: false, error: "Error de conexión con el backend local" };
  }
}

export async function createRole(data: {
  name: string;
  slug: string;
  permissionIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const denied = await canManage("roles.create");
    if (denied) return { success: false, error: denied };
    const response = await fetchAuthBackend("/roles", {
      method: "POST", headers: await backendHeaders(), body: JSON.stringify(data),
    });
    if (!response.ok) return { success: false, error: await responseError(response, "Error al crear rol") };
    revalidatePath("/panel/roles");
    return { success: true };
  } catch {
    return { success: false, error: "Error de conexión con el backend local" };
  }
}

export async function updateRole(data: {
  id: string;
  name?: string;
  permissionIds?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const denied = await canManage("roles.update");
    if (denied) return { success: false, error: denied };
    const { id, ...body } = data;
    const response = await fetchAuthBackend(`/roles/${encodeURIComponent(id)}`, {
      method: "PATCH", headers: await backendHeaders(), body: JSON.stringify(body),
    });
    if (!response.ok) return { success: false, error: await responseError(response, "Error al actualizar rol") };
    revalidatePath("/panel/roles");
    return { success: true };
  } catch {
    return { success: false, error: "Error de conexión con el backend local" };
  }
}

export async function deleteRole(data: {
  id: string;
  replacementRoleSlug?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const denied = await canManage("roles.delete");
    if (denied) return { success: false, error: denied };
    const response = await fetchAuthBackend(`/roles/${encodeURIComponent(data.id)}`, {
      method: "DELETE", headers: await backendHeaders(),
      body: JSON.stringify({ replacementRoleSlug: data.replacementRoleSlug }),
    });
    if (!response.ok) return { success: false, error: await responseError(response, "Error al eliminar rol") };
    revalidatePath("/panel/roles");
    return { success: true };
  } catch {
    return { success: false, error: "Error de conexión con el backend local" };
  }
}
