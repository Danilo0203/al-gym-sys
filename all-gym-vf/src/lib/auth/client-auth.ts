"use client";

import {
  getAuthErrorMessage,
  parseAuthContext,
  parseAuthLoginRequest,
  parseJsonText,
  type AuthContext,
  type AuthLoginRequest,
} from "@/lib/auth/contracts";

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

interface AuthErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

export class LocalAuthProxyError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "LocalAuthProxyError";
    this.status = status;
    this.code = code;
  }
}

async function readJsonPayload(response: Response, source: string): Promise<unknown | null> {
  const responseText = await response.text();
  if (!responseText.trim()) {
    return null;
  }

  return parseJsonText(responseText, source);
}

function getAuthErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return ((payload as AuthErrorPayload).error?.code as string | undefined) ?? null;
}

function mapChangePasswordErrorMessage(status: number, code: string | null, fallbackMessage: string | null): string {
  if (status === 503) {
    return "No fue posible conectar con el backend local.";
  }

  if (status === 500) {
    return "Ocurrió un error al cambiar la contraseña. Intenta nuevamente.";
  }

  switch (code) {
    case "VALIDATION_ERROR":
      return "La solicitud de cambio de contraseña es inválida.";
    case "INVALID_CURRENT_PASSWORD":
      return "La contraseña actual es incorrecta.";
    case "PASSWORD_UNCHANGED":
      return "La nueva contraseña debe ser diferente a la actual.";
    case "INVALID_SESSION":
      return "Sesión inválida. Inicia sesión nuevamente.";
    case "USER_NOT_FOUND":
      return "No se encontró el usuario asociado a la sesión.";
    case "BACKEND_UNAVAILABLE":
      return "No fue posible conectar con el backend local.";
    default:
      return fallbackMessage ?? "No fue posible cambiar la contraseña.";
  }
}

export async function loginWithLocalAuth(input: AuthLoginRequest): Promise<AuthContext> {
  const credentials = parseAuthLoginRequest(input);
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const payload = await readJsonPayload(response, "Local login proxy");

  if (!response.ok) {
    throw new Error(getAuthErrorMessage(payload) ?? "No fue posible iniciar sesión.");
  }

  if (!payload) {
    throw new Error("Local login proxy returned an empty body.");
  }

  return parseAuthContext(payload, "Local login proxy");
}

export async function getCurrentLocalAuthContext(): Promise<AuthContext | null> {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  const payload = await readJsonPayload(response, "Local auth proxy");

  if (!response.ok) {
    throw new Error(getAuthErrorMessage(payload) ?? "No fue posible validar la sesión local.");
  }

  if (!payload) {
    throw new Error("Local auth proxy returned an empty body.");
  }

  return parseAuthContext(payload, "Local auth proxy");
}

export async function logoutFromLocalAuth(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 204) {
    return;
  }

  const payload = await readJsonPayload(response, "Local logout proxy");

  if (!response.ok) {
    throw new Error(getAuthErrorMessage(payload) ?? "No fue posible cerrar la sesión.");
  }
}

export async function changePasswordWithLocalAuth(input: ChangePasswordRequest): Promise<void> {
  const response = await fetch("/api/auth/change-password", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await readJsonPayload(response, "Local change password proxy");

  if (!response.ok) {
    const code = getAuthErrorCode(payload);
    throw new LocalAuthProxyError(
      response.status,
      mapChangePasswordErrorMessage(response.status, code, getAuthErrorMessage(payload)),
      code,
    );
  }
}
