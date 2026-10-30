"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { reconcileLocalCustomerOnClock, reconcileLocalInternalUserOnClock } from "@/features/cash/lib/local-device-sync";

export interface RoleTransitionInput {
  id: string;
  role: "client" | "trainer";
  is_active: boolean;
  birth_date?: string;
  email?: string;
  password?: string;
}

export async function transitionUserRole(input: RoleTransitionInput): Promise<{
  success: boolean;
  error?: string;
  syncPending?: boolean;
}> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!access.isAdmin || !hasPermission(access, "users.update") || !hasPermission(access, "customers.update")) {
      return { success: false, error: "Solo un propietario o administrador con permisos puede cambiar entre cliente y entrenador." };
    }
    const headers = new Headers({ "content-type": "application/json" });
    const cookieHeader = buildCookieHeader((await cookies()).getAll());
    if (cookieHeader) headers.set("cookie", cookieHeader);
    const { id, ...body } = input;
    const response = await fetchAuthBackend(`/users/${encodeURIComponent(id)}/role-transition`, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      return { success: false, error: result?.error?.message ?? "No se pudo cambiar el rol." };
    }

    const sync = input.role === "trainer"
      ? await reconcileLocalInternalUserOnClock(id)
      : await reconcileLocalCustomerOnClock(id);
    revalidatePath("/panel/clientes", "layout");
    revalidatePath("/panel/usuarios");
    revalidatePath("/panel/resumen");
    revalidatePath("/panel/caja");
    return { success: true, syncPending: !sync.synced };
  } catch {
    return { success: false, error: "No se pudo confirmar el cambio. Actualiza el listado antes de volver a intentarlo." };
  }
}
