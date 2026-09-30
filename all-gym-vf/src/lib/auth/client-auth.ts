"use client";

import {
  authChangePasswordResponseSchema,
  authContextSchema,
  authErrorResponseSchema,
  authLoginRequestSchema,
  isJsonContentType,
  type AuthChangePasswordRequest,
  type AuthContext,
  type AuthLoginRequest,
} from "@/lib/auth/contracts";

export class LocalAuthProxyError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "LocalAuthProxyError";
    this.status = status;
    this.code = code;
  }
}

async function readProxyPayload(response: Response): Promise<unknown | null> {
  if (response.status === 204) return null;

  if (!isJsonContentType(response.headers.get("content-type"))) {
    throw new LocalAuthProxyError(502, "El servicio de autenticación devolvió una respuesta inválida.");
  }

  try {
    return await response.json();
  } catch {
    throw new LocalAuthProxyError(502, "El servicio de autenticación devolvió una respuesta inválida.");
  }
}

function throwProxyError(response: Response, payload: unknown): never {
  const parsed = authErrorResponseSchema.safeParse(payload);
  throw new LocalAuthProxyError(
    response.status,
    parsed.success ? parsed.data.error.message : "No fue posible completar la solicitud.",
    parsed.success ? parsed.data.error.code : null,
  );
}

export async function loginWithLocalAuth(input: AuthLoginRequest): Promise<AuthContext> {
  const credentials = authLoginRequestSchema.parse(input);
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(credentials),
  });
  const payload = await readProxyPayload(response);

  if (!response.ok) throwProxyError(response, payload);

  const parsed = authContextSchema.safeParse(payload);
  if (!parsed.success) {
    throw new LocalAuthProxyError(502, "El servicio de autenticación devolvió una sesión inválida.");
  }
  return parsed.data;
}

export async function getCurrentLocalAuthContext(): Promise<AuthContext | null> {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) return null;
  const payload = await readProxyPayload(response);
  if (!response.ok) throwProxyError(response, payload);

  const parsed = authContextSchema.safeParse(payload);
  if (!parsed.success) {
    throw new LocalAuthProxyError(502, "El servicio de autenticación devolvió una sesión inválida.");
  }
  return parsed.data;
}

export async function logoutFromLocalAuth(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 204) return;
  const payload = await readProxyPayload(response);
  if (!response.ok) throwProxyError(response, payload);
}

export async function changePasswordWithLocalAuth(input: AuthChangePasswordRequest): Promise<void> {
  const response = await fetch("/api/auth/change-password", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await readProxyPayload(response);

  if (!response.ok) throwProxyError(response, payload);

  const parsed = authChangePasswordResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new LocalAuthProxyError(502, "El servicio de autenticación devolvió una respuesta inválida.");
  }
}
