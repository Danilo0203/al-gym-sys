import { requestLocalAdmin } from "@/lib/api/local-admin";
import type { ExtendedColumnSort } from "@/types/data-table";

export interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  role_name?: string | null;
  role_scope?: string | null;
  status: "active" | "disabled" | "locked";
  is_active: boolean;
  created_at: string;
  last_sign_in_at?: string | null;
  must_change_password?: boolean;
}

export interface CreateUserData {
  email: string;
  password?: string;
  full_name: string;
  role: string;
}

export interface UpdateUserData {
  id: string;
  full_name?: string;
  role?: string;
  password?: string;
  email?: string;
}

export interface UserStatusData {
  id: string;
  status: "active" | "disabled";
}

export interface RoleOption {
  slug: string;
  name: string;
  scope: "panel" | "client";
}

type ApiUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  role_name: string | null;
  role_scope: string | null;
  status: "active" | "disabled" | "locked";
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  must_change_password: boolean;
};

type ApiRoleRow = {
  slug: string;
  name: string;
  scope: "panel" | "client";
};

function mapUser(row: ApiUserRow): UserData {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    role_name: row.role_name,
    role_scope: row.role_scope,
    status: row.status,
    is_active: row.is_active,
    created_at: row.created_at,
    last_sign_in_at: row.last_login_at,
    must_change_password: row.must_change_password
  };
}

async function fetchRoleOptions() {
  const roles = await requestLocalAdmin<ApiRoleRow[]>("/api/panel/roles");
  return roles;
}

export async function getAvailableRoles(): Promise<{ success: boolean; data?: RoleOption[]; error?: string }> {
  try {
    const roles = await fetchRoleOptions();
    return { success: true, data: roles.map((role) => ({ slug: role.slug, name: role.name, scope: role.scope })) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al obtener roles" };
  }
}

export async function getUsers(params?: {
  sort?: ExtendedColumnSort<UserData>[] | null;
  role?: string | string[] | null;
  full_name?: string | null;
}): Promise<{ success: boolean; data?: UserData[]; error?: string; roleNameMap?: Record<string, string> }> {
  try {
    const [users, roles] = await Promise.all([
      requestLocalAdmin<ApiUserRow[]>("/api/panel/users"),
      fetchRoleOptions()
    ]);

    const mappedUsers = users.map(mapUser);
    const roleNameMap = roles.reduce<Record<string, string>>((acc, role) => {
      acc[role.slug] = role.name;
      return acc;
    }, {});

    const filteredUsers = mappedUsers.filter((user) => {
      if (params?.role) {
        const rolesFilter = typeof params.role === "string" ? params.role.split(",") : params.role;
        if (rolesFilter.length > 0 && user.role && !rolesFilter.includes(user.role)) {
          return false;
        }
      }

      if (params?.full_name) {
        const search = params.full_name.toLowerCase();
        const haystack = `${user.full_name ?? ""} ${user.email}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      return true;
    });

    if (params?.sort && params.sort.length > 0) {
      const sorted = [...filteredUsers].sort((a, b) => {
        for (const sortItem of params.sort ?? []) {
          const direction = sortItem.desc ? -1 : 1;
          if (sortItem.id === "full_name") {
            const left = (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email, undefined, { sensitivity: "base" });
            if (left !== 0) return left * direction;
          }
          if (sortItem.id === "role") {
            const left = (a.role ?? "").localeCompare(b.role ?? "");
            if (left !== 0) return left * direction;
          }
          if (sortItem.id === "created_at") {
            const left = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            if (left !== 0) return left * direction;
          }
        }
        return 0;
      });

      return { success: true, data: sorted, roleNameMap };
    }

    return { success: true, data: filteredUsers, roleNameMap };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al obtener usuarios" };
  }
}

export async function getUserById(id: string): Promise<{ success: boolean; data?: UserData; error?: string }> {
  try {
    const user = await requestLocalAdmin<ApiUserRow>(`/api/panel/users/${id}`);
    return { success: true, data: mapUser(user) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al obtener usuario" };
  }
}

export async function createUser(data: CreateUserData): Promise<{ success: boolean; error?: string }> {
  try {
    await requestLocalAdmin<UserData>("/api/panel/users", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        role: data.role
      })
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al crear usuario" };
  }
}

export async function updateUser(data: UpdateUserData): Promise<{ success: boolean; error?: string }> {
  try {
    await requestLocalAdmin<UserData>(`/api/panel/users/${data.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        email: data.email,
        full_name: data.full_name,
        password: data.password,
        role: data.role
      })
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al actualizar usuario" };
  }
}

export async function changeUserRole(data: { id: string; role: string }): Promise<{ success: boolean; error?: string }> {
  try {
    await requestLocalAdmin<UserData>(`/api/panel/users/${data.id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: data.role })
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al cambiar rol" };
  }
}

export async function setUserStatus(data: UserStatusData): Promise<{ success: boolean; error?: string }> {
  try {
    await requestLocalAdmin<UserData>(`/api/panel/users/${data.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: data.status })
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al actualizar estado" };
  }
}

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requestLocalAdmin<null>(`/api/panel/users/${userId}`, {
      method: "DELETE"
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al eliminar usuario" };
  }
}
