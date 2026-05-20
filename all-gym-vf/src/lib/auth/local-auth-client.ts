"use client";

import {
  type LocalAuthErrorResponse,
  type LocalAuthLoginResponse,
  type LocalAuthMeResponse,
  getLocalAuthErrorMessage,
} from "@/lib/auth/local-auth-shared";

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function loginWithLocalAuth(input: { email: string; password: string }) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });

  const payload = await parseJson<LocalAuthLoginResponse | LocalAuthErrorResponse>(response);
  if (!response.ok) {
    throw new Error(getLocalAuthErrorMessage(payload as LocalAuthErrorResponse | null, "Error al iniciar sesión"));
  }

  return payload as LocalAuthLoginResponse;
}

export async function logoutCurrentLocalUser() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });

  if (response.status === 204) {
    return;
  }

  const payload = await parseJson<LocalAuthErrorResponse>(response);
  if (!response.ok) {
    throw new Error(getLocalAuthErrorMessage(payload, "Error al cerrar sesión"));
  }
}

export async function getCurrentLocalUser() {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
  });

  if (response.status === 401) {
    return null;
  }

  const payload = await parseJson<LocalAuthMeResponse | LocalAuthErrorResponse>(response);
  if (!response.ok) {
    throw new Error(getLocalAuthErrorMessage(payload as LocalAuthErrorResponse | null, "Error al obtener sesión"));
  }

  return payload as LocalAuthMeResponse;
}
