"use client";

import {
  getAuthErrorMessage,
  parseAuthContext,
  parseAuthLoginRequest,
  parseJsonText,
  type AuthContext,
  type AuthLoginRequest,
} from "@/lib/auth/contracts";

async function readJsonPayload(response: Response, source: string): Promise<unknown | null> {
  const responseText = await response.text();
  if (!responseText.trim()) {
    return null;
  }

  return parseJsonText(responseText, source);
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
