import { cache } from "react";
import { cookies } from "next/headers";
import { z } from "zod";

import {
  AuthBackendTransportError,
  buildCookieHeader,
  fetchAuthBackend,
} from "@/lib/auth/backend-auth";
import { getAuthError, isJsonContentType } from "@/lib/auth/contracts";

const localProfileSchema = z
  .object({
    id: z.uuid(),
    email: z.email().nullable(),
    full_name: z.string(),
    phone: z.string(),
    birth_date: z.string().nullable(),
    gender: z.enum(["male", "female", "other"]),
    avatar_url: z.string().nullable(),
    role: z.string().nullable(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
  })
  .strict();

const localProfileUpdateSchema = z
  .object({
    full_name: z.string().trim().min(2).optional(),
    phone: z.string().optional(),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export type LocalProfile = z.infer<typeof localProfileSchema>;
export type LocalProfileUpdate = z.infer<typeof localProfileUpdateSchema>;

export class LocalProfileError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "LocalProfileError";
    this.status = status;
    this.code = code;
  }
}

async function getCookieHeader(): Promise<string | null> {
  return buildCookieHeader((await cookies()).getAll());
}

async function readProfileResponse(response: Response): Promise<LocalProfile> {
  if (!isJsonContentType(response.headers.get("content-type"))) {
    throw new LocalProfileError(502, "INVALID_BACKEND_RESPONSE", "El backend local devolvió un perfil inválido.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new LocalProfileError(502, "INVALID_BACKEND_RESPONSE", "El backend local devolvió un perfil inválido.");
  }

  if (!response.ok) {
    const backendError = getAuthError(payload);
    const safeMessages: Record<string, string> = {
      INVALID_SESSION: "Sesión inválida. Inicia sesión nuevamente.",
      PROFILE_INACTIVE: "Perfil inactivo",
      FORBIDDEN: "No tienes permiso para editar este perfil.",
      PROFILE_NOT_FOUND: "Perfil no encontrado.",
      VALIDATION_ERROR: "Datos inválidos para actualizar el perfil.",
    };
    throw new LocalProfileError(
      response.status,
      backendError?.code ?? null,
      (backendError && safeMessages[backendError.code]) || "No fue posible procesar el perfil.",
    );
  }

  const parsed = localProfileSchema.safeParse(payload);
  if (!parsed.success) {
    throw new LocalProfileError(502, "INVALID_BACKEND_RESPONSE", "El backend local devolvió un perfil inválido.");
  }
  return parsed.data;
}

async function requestLocalProfile(method: "GET" | "PATCH", body?: LocalProfileUpdate): Promise<LocalProfile> {
  try {
    const cookieHeader = await getCookieHeader();
    const response = await fetchAuthBackend("/profile", {
      method,
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return readProfileResponse(response);
  } catch (error) {
    if (error instanceof LocalProfileError) throw error;
    if (error instanceof AuthBackendTransportError) {
      throw new LocalProfileError(
        error.kind === "timeout" ? 504 : 503,
        error.kind === "timeout" ? "AUTH_BACKEND_TIMEOUT" : "AUTH_BACKEND_UNAVAILABLE",
        error.kind === "timeout"
          ? "El backend local tardó demasiado en responder."
          : "No fue posible conectar con el backend local.",
      );
    }
    throw new LocalProfileError(500, null, "No fue posible procesar el perfil.");
  }
}

export const getLocalProfile = cache(() => requestLocalProfile("GET"));

export async function updateLocalProfile(input: LocalProfileUpdate): Promise<LocalProfile> {
  const parsed = localProfileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new LocalProfileError(400, "VALIDATION_ERROR", "Datos inválidos para actualizar el perfil.");
  }
  return requestLocalProfile("PATCH", parsed.data);
}
