"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { INTERNAL_USER_ROLES, isInternalRole } from "@/lib/auth/role-utils";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import type { UserRole } from "@/types";
import type { ExtendedColumnSort } from "@/types/data-table";

export interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_sign_in_at?: string | null;
}

export interface CreateUserData {
  email: string;
  password?: string;
  full_name: string;
  role: UserRole;
}

export interface UpdateUserData {
  id: string;
  full_name?: string;
  role?: UserRole;
  password?: string;
  is_active?: boolean;
}

export interface RoleOption {
  slug: string;
  name: string;
}

type BackendError = { error?: { message?: string } };

async function backendHeaders(): Promise<Headers> {
  const cookieHeader = buildCookieHeader((await cookies()).getAll());
  const headers = new Headers({ "content-type": "application/json" });
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return headers;
}

async function responseError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as BackendError | null;
  return body?.error?.message || fallback;
}

export async function getAvailableRoles(): Promise<{ success: boolean; data?: RoleOption[]; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "users.view")) return { success: false, error: "No autorizado" };
    const response = await fetchAuthBackend("/users/roles", { headers: await backendHeaders() });
    if (!response.ok) return { success: false, error: await responseError(response, "Error al obtener roles") };
    const payload = (await response.json()) as { data?: RoleOption[] };
    return {
      success: true,
      data: (payload.data ?? []).filter((role) =>
        INTERNAL_USER_ROLES.includes(role.slug as (typeof INTERNAL_USER_ROLES)[number])),
    };
  } catch {
    return { success: false, error: "Error al obtener roles" };
  }
}

export async function getUsers(params?: {
  sort?: ExtendedColumnSort<UserData>[] | null;
  role?: string | string[] | null;
  full_name?: string | null;
}): Promise<{ success: boolean; data?: UserData[]; error?: string; roleNameMap?: Record<string, string> }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "users.view")) {
      return { success: false, error: "No autorizado: Se requiere permiso users.view" };
    }

    const headers = await backendHeaders();
    const [usersResponse, rolesResponse] = await Promise.all([
      fetchAuthBackend("/users", { headers }),
      fetchAuthBackend("/users/roles", { headers }),
    ]);
    if (!usersResponse.ok || !rolesResponse.ok) {
      return { success: false, error: "Error al obtener usuarios" };
    }
    const usersPayload = (await usersResponse.json()) as { data?: UserData[] };
    const rolesPayload = (await rolesResponse.json()) as { data?: RoleOption[] };
    const users = (usersPayload.data ?? []).filter((user) => isInternalRole(user.role));
    const roleNameMap = Object.fromEntries((rolesPayload.data ?? []).map((role) => [role.slug, role.name]));
    const { sort, role, full_name } = params || {};
    const selectedRoles = role ? (Array.isArray(role) ? role : role.split(",")) : [];
    const query = full_name?.trim().toLocaleLowerCase("es-GT") || "";
    const filtered = users.filter((user) =>
      (selectedRoles.length === 0 || selectedRoles.includes(user.role)) &&
      (!query || `${user.full_name ?? ""} ${user.email}`.toLocaleLowerCase("es-GT").includes(query)));

    const comparators: Record<string, (a: UserData, b: UserData) => number> = {
      full_name: (a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email, "es-GT", { sensitivity: "base" }),
      role: (a, b) => a.role.localeCompare(b.role),
      created_at: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    };
    filtered.sort((a, b) => {
      for (const item of sort ?? []) {
        const comparator = comparators[item.id];
        if (!comparator) continue;
        const value = comparator(a, b) * (item.desc ? -1 : 1);
        if (value !== 0) return value;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return { success: true, data: filtered, roleNameMap };
  } catch {
    return { success: false, error: "Error al obtener usuarios" };
  }
}

export async function createUser(data: CreateUserData): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "users.create")) return { success: false, error: "No autorizado" };
    if (!isInternalRole(data.role)) return { success: false, error: "Los clientes se administran desde Clientes" };
    if (!data.password) return { success: false, error: "La contraseña es obligatoria" };
    const response = await fetchAuthBackend("/users", {
      method: "POST", headers: await backendHeaders(), body: JSON.stringify(data),
    });
    if (!response.ok) return { success: false, error: await responseError(response, "No se pudo crear el usuario") };
    revalidatePath("/panel/usuarios");
    return { success: true };
  } catch {
    return { success: false, error: "Error de conexión con el backend local" };
  }
}

export async function updateUser(data: UpdateUserData): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "users.update")) return { success: false, error: "No autorizado" };
    if (data.role && !isInternalRole(data.role)) return { success: false, error: "Rol no válido" };
    const { id, ...body } = data;
    const response = await fetchAuthBackend(`/users/${encodeURIComponent(id)}`, {
      method: "PATCH", headers: await backendHeaders(), body: JSON.stringify(body),
    });
    if (!response.ok) return { success: false, error: await responseError(response, "No se pudo actualizar el usuario") };
    revalidatePath("/panel/usuarios");
    return { success: true };
  } catch {
    return { success: false, error: "Error de conexión con el backend local" };
  }
}

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "users.delete")) return { success: false, error: "No autorizado" };
    const response = await fetchAuthBackend(`/users/${encodeURIComponent(userId)}`, {
      method: "DELETE", headers: await backendHeaders(),
    });
    if (!response.ok) return { success: false, error: await responseError(response, "No se pudo eliminar el usuario") };
    revalidatePath("/panel/usuarios");
    return { success: true };
  } catch {
    return { success: false, error: "Error de conexión con el backend local" };
  }
}
