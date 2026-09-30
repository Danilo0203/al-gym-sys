"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { fetchAuthBackend } from "@/lib/auth/backend-auth";

const messageTemplateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  content: z.string(),
  is_active: z.boolean(),
  created_by: z.uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type MessageTemplate = z.infer<typeof messageTemplateSchema>;

async function messageRequest(path: string, init?: RequestInit): Promise<Response> {
  const cookieStore = await cookies();
  const headers = new Headers(init?.headers);
  const cookieHeader = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
  if (cookieHeader) headers.set("cookie", cookieHeader);
  if (init?.body) headers.set("content-type", "application/json");
  return fetchAuthBackend(`/messages${path}`, { ...init, headers, cache: "no-store" });
}

async function messageError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return payload?.error?.message || "No se pudo completar la solicitud";
}

async function authorized(permission: string): Promise<string | null> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return "No autenticado";
    if (!hasPermission(access, permission)) return "No autorizado";
    return null;
  } catch {
    return "No se pudo verificar la sesión";
  }
}

export async function getMessageTemplates(params?: {
  includeInactive?: boolean;
}): Promise<{ success: boolean; data?: MessageTemplate[]; error?: string }> {
  const error = await authorized("messages.view");
  if (error) return { success: false, error };
  try {
    const response = await messageRequest(`?include_inactive=${params?.includeInactive === true}`);
    if (!response.ok) return { success: false, error: await messageError(response) };
    const payload = z.object({ data: z.array(messageTemplateSchema) }).parse(await response.json());
    return { success: true, data: payload.data };
  } catch {
    return { success: false, error: "Error al obtener mensajes" };
  }
}

export async function createMessageTemplate(data: {
  name: string;
  content: string;
}): Promise<{ success: boolean; error?: string }> {
  const error = await authorized("messages.create");
  if (error) return { success: false, error };
  try {
    const response = await messageRequest("", { method: "POST", body: JSON.stringify(data) });
    if (!response.ok) return { success: false, error: await messageError(response) };
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
  const error = await authorized("messages.update");
  if (error) return { success: false, error };
  try {
    const { id, ...input } = data;
    const response = await messageRequest(`/${encodeURIComponent(id)}`, {
      method: "PATCH", body: JSON.stringify(input),
    });
    if (!response.ok) return { success: false, error: await messageError(response) };
    revalidatePath("/panel/mensajes");
    return { success: true };
  } catch {
    return { success: false, error: "Error al actualizar el mensaje" };
  }
}

export async function deleteMessageTemplate(id: string): Promise<{ success: boolean; error?: string }> {
  const error = await authorized("messages.delete");
  if (error) return { success: false, error };
  try {
    const response = await messageRequest(`/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) return { success: false, error: await messageError(response) };
    revalidatePath("/panel/mensajes");
    return { success: true };
  } catch {
    return { success: false, error: "Error al eliminar el mensaje" };
  }
}

export async function toggleMessageTemplateActive(id: string, is_active: boolean) {
  return updateMessageTemplate({ id, is_active });
}
