import { cache } from "react";
import { cookies } from "next/headers";

import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { authContextSchema, getAuthError, isJsonContentType, type AuthContext } from "@/lib/auth/contracts";

async function fetchServerAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  const response = await fetchAuthBackend("/auth/me", {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  if (response.status === 401) return null;

  if (!isJsonContentType(response.headers.get("content-type"))) {
    throw new Error("El backend local devolvió una respuesta de sesión inválida.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("El backend local devolvió una respuesta de sesión inválida.");
  }

  if (!response.ok) {
    const error = getAuthError(payload);
    if (response.status === 403 && error?.code === "PROFILE_INACTIVE") {
      throw new Error("Perfil inactivo");
    }
    throw new Error("No fue posible validar la sesión local.");
  }

  const parsed = authContextSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("El backend local devolvió un contrato de sesión inválido.");
  }

  return parsed.data;
}

export const getServerAuthContext = cache(fetchServerAuthContext);
