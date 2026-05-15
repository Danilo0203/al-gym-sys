"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { revalidatePath } from "next/cache";
import { UserRole } from "@/types";

export interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
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
}

import { ExtendedColumnSort } from "@/types/data-table";

type AuthUserRecord = {
  id: string;
  email: string | null;
  created_at: string;
  user_metadata?: Record<string, unknown> | null;
  raw_user_meta_data?: Record<string, unknown> | null;
};

const VALID_USER_ROLES: UserRole[] = ["owner", "admin", "trainer", "employee", "client"];

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && VALID_USER_ROLES.includes(value as UserRole);
}

function normalizeRole(value: unknown): UserRole {
  return isUserRole(value) ? value : "client";
}

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

export interface RoleOption {
  slug: string;
  name: string;
}

/**
 * Get available roles for the user form dropdown.
 * Only panel-scoped roles + client are returned.
 * Owner role is only included for users with the right permission.
 */
export async function getAvailableRoles(): Promise<{ success: boolean; data?: RoleOption[]; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("roles")
      .select("slug, name")
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };

    return { success: true, data: data as RoleOption[] };
  } catch {
    return { success: false, error: "Error al obtener roles" };
  }
}

/**
 * Get all users from the profiles table
 * Note: specific columns are selected to avoid over-fetching
 */
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

    const { sort, role, full_name } = params || {};

    // Use Admin Client to bypass RLS and ensure we get all users
    const adminClient = createAdminClient();
    const [profilesResult, authUsers, rolesResult] = await Promise.all([
      adminClient.from("profiles").select("id, full_name, role, created_at"),
      listAllAuthUsers(adminClient),
      adminClient.from("roles").select("slug, name"),
    ]);

    const { data: profiles, error: profilesError } = profilesResult;

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return { success: false, error: profilesError.message };
    }

    // 2. Get Auth Users to get emails
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

    // 2. Merge Auth + profile data so users without a profile still appear
    const combinedData = authUsers.map((authUser) => {
      const profile = profilesById.get(authUser.id);
      const metadata = authUser.user_metadata ?? authUser.raw_user_meta_data ?? {};
      const fullName =
        profile?.full_name ??
        (typeof metadata.full_name === "string" && metadata.full_name.trim() ? metadata.full_name : null);

      return {
        id: authUser.id,
        email: authUser.email || "Sin email",
        full_name: fullName,
        role: normalizeRole(profile?.role ?? metadata.role),
        created_at: profile?.created_at ?? authUser.created_at,
      };
    });

    const filteredData = combinedData.filter((user) => {
      if (role) {
        const roles = typeof role === "string" ? role.split(",") : Array.isArray(role) ? role : [role];
        if (roles.length > 0 && !roles.includes(user.role)) {
          return false;
        }
      }

      if (full_name) {
        const search = full_name.toLowerCase();
        const haystack = `${user.full_name ?? ""} ${user.email}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });

    const sortComparators: Record<string, (a: UserData, b: UserData, desc: boolean) => number> = {
      full_name: (a, b, desc) =>
        (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email, undefined, { sensitivity: "base" }) *
        (desc ? -1 : 1),
      role: (a, b, desc) => a.role.localeCompare(b.role) * (desc ? -1 : 1),
      created_at: (a, b, desc) =>
        (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * (desc ? -1 : 1),
    };

    const sortedData = [...filteredData];
    if (sort && sort.length > 0) {
      sortedData.sort((a, b) => {
        for (const s of sort) {
          const comparator = sortComparators[s.id];
          if (!comparator) continue;
          const result = comparator(a, b, s.desc);
          if (result !== 0) return result;
        }
        return 0;
      });
    } else {
      sortedData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const roleNameMap: Record<string, string> = {};
    if (rolesResult.data) {
      for (const r of rolesResult.data as { slug: string; name: string }[]) {
        roleNameMap[r.slug] = r.name;
      }
    }

    return { success: true, data: sortedData as UserData[], roleNameMap };
  } catch (error) {
    console.error("Error in getUsers:", error);
    return { success: false, error: "Error al obtener usuarios" };
  }
}

/**
 * Create a new user using Supabase Admin API
 */
export async function createUser(data: CreateUserData): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "users.create")) {
      return { success: false, error: "No autorizado: Se requiere permiso users.create" };
    }
    const adminClient = createAdminClient();
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: data.email,
      password: data.password || "tempPassword123!", // Provide a default if not set? Or require it.
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        role: data.role, // Store role in metadata too for easy access
      },
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      return { success: false, error: authError.message };
    }

    if (!authUser.user) {
      return { success: false, error: "No se pudo crear el usuario" };
    }

    // 2. Update profile with role (trigger creates the row, we just update)
    // IMPORTANT: 'email' column does not exist in profiles table
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name: data.full_name,
        role: data.role,
      })
      .eq("id", authUser.user.id);

    if (profileError) {
      // If update fails, maybe the row doesn't exist yet (trigger delay).
      // In that case, we might insert it, but usually triggers are fast.
      console.error("Error updating profile role:", profileError);
      // Try insert if update failed (though trigger should handle it)
    }

    revalidatePath("/panel/usuarios");
    return { success: true };
  } catch (error) {
    console.error("Error in createUser:", error);
    return { success: false, error: "Error inesperado al crear usuario" };
  }
}

/**
 * Update a user
 */
export async function updateUser(data: UpdateUserData): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "users.update")) {
      return { success: false, error: "No autorizado: Se requiere permiso users.update" };
    }
    const adminClient = createAdminClient();
    const updateData: Pick<UpdateUserData, "full_name" | "role"> = {};
    if (data.full_name) updateData.full_name = data.full_name;
    if (data.role) updateData.role = data.role;

    if (Object.keys(updateData).length > 0) {
      const { error: profileError } = await adminClient.from("profiles").update(updateData).eq("id", data.id);

      if (profileError) {
        return { success: false, error: profileError.message };
      }
    }

    // 2. Update Auth password if provided
    if (data.password) {
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(data.id, {
        password: data.password,
      });

      if (passwordError) {
        return { success: false, error: passwordError.message };
      }
    }

    // Required to sync metadata if we rely on it
    if (data.full_name || data.role) {
      await adminClient.auth.admin.updateUserById(data.id, {
        user_metadata: { full_name: data.full_name, role: data.role },
      });
    }

    revalidatePath("/panel/usuarios");
    return { success: true };
  } catch (error) {
    console.error("Error in updateUser:", error);
    return { success: false, error: "Error inesperado al actualizar usuario" };
  }
}

/**
 * Delete a user
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "users.delete")) {
      return { success: false, error: "No autorizado: Se requiere permiso users.delete" };
    }

    const adminClient = createAdminClient();

    // Delete from Auth; the profile row will cascade depending on FK setup.
    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) {
      console.error("Error deleting user:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/panel/usuarios");
    return { success: true };
  } catch (error) {
    console.error("Error in deleteUser:", error);
    return { success: false, error: "Error inesperado al eliminar usuario" };
  }
}
