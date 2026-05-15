"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { revalidatePath } from "next/cache";

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getMessageTemplates(params?: {
  includeInactive?: boolean;
}): Promise<{ success: boolean; data?: MessageTemplate[]; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "messages.view")) {
      return { success: false, error: "No autorizado" };
    }

    const adminClient = createAdminClient();
    let query = adminClient
      .from("message_templates")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!(params?.includeInactive)) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as MessageTemplate[] };
  } catch {
    return { success: false, error: "Error al obtener mensajes" };
  }
}

export async function createMessageTemplate(data: {
  name: string;
  content: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "messages.create")) {
      return { success: false, error: "No autorizado" };
    }

    const adminClient = createAdminClient();

    const { error } = await adminClient.from("message_templates").insert({
      name: data.name,
      content: data.content,
      is_active: true,
      created_by: access.userId,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/panel/mensajes");
    return { success: true };
  } catch {
    return { success: false, error: "Error al crear el mensaje" };
  }
}

export async function updateMessageTemplate(data: {
  id: string;
  name?: string;
  content?: string;
  is_active?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "messages.update")) {
      return { success: false, error: "No autorizado" };
    }

    const adminClient = createAdminClient();
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const { error } = await adminClient
      .from("message_templates")
      .update(updateData)
      .eq("id", data.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/panel/mensajes");
    return { success: true };
  } catch {
    return { success: false, error: "Error al actualizar el mensaje" };
  }
}

export async function deleteMessageTemplate(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!hasPermission(access, "messages.delete")) {
      return { success: false, error: "No autorizado" };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient.from("message_templates").delete().eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/panel/mensajes");
    return { success: true };
  } catch {
    return { success: false, error: "Error al eliminar el mensaje" };
  }
}

export async function toggleMessageTemplateActive(
  id: string,
  is_active: boolean,
): Promise<{ success: boolean; error?: string }> {
  return updateMessageTemplate({ id, is_active });
}
