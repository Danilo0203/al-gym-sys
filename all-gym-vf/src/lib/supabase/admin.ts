import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con permisos de administrador
 * SOLO usar en el servidor, NUNCA exponer en el cliente
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase admin credentials. Please configure SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Obtiene el email de un usuario desde auth.users
 * @param userId - ID del usuario
 * @returns Email del usuario o null si no se encuentra
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const adminClient = createAdminClient();
    const {
      data: { user },
      error,
    } = await adminClient.auth.admin.getUserById(userId);

    if (error) {
      console.error("Error fetching user email:", error);
      return null;
    }

    return user?.email || null;
  } catch (error) {
    console.error("Exception fetching user email:", error);
    return null;
  }
}
