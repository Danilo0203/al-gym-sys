import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";

import {
  AuthBackendTransportError,
  fetchAuthBackend,
  getSetCookieHeaders,
} from "@/lib/auth/backend-auth";
import { getAuthError, isJsonContentType } from "@/lib/auth/contracts";

type AuthProxyOptions = {
  pathname: string;
  method: "GET" | "POST";
  requestSchema?: z.ZodType;
  responseSchema?: z.ZodType;
  allowNoContent?: boolean;
};

type SafeAuthError = {
  status: number;
  code: string;
  message: string;
};

const safeErrorMessages: Record<string, string> = {
  INVALID_CREDENTIALS: "Credenciales inválidas",
  INVALID_SESSION: "Sesión inválida",
  PROFILE_INACTIVE: "Perfil inactivo",
  VALIDATION_ERROR: "Solicitud inválida",
  INVALID_CURRENT_PASSWORD: "La contraseña actual es incorrecta",
  PASSWORD_UNCHANGED: "La nueva contraseña no puede ser igual a la actual",
  USER_NOT_FOUND: "Usuario no encontrado",
  RATE_LIMITED: "Demasiados intentos. Inténtalo de nuevo más tarde.",
  METHOD_NOT_ALLOWED: "Método no permitido",
};

function safeErrorForStatus(status: number, payload: unknown): SafeAuthError {
  const upstreamError = getAuthError(payload);
  const safeMessage = upstreamError ? safeErrorMessages[upstreamError.code] : undefined;

  if (status === 400) {
    const code = safeMessage ? upstreamError?.code ?? "VALIDATION_ERROR" : "VALIDATION_ERROR";
    return { status, code, message: safeErrorMessages[code] ?? "Solicitud inválida" };
  }

  if (status === 401) {
    const code = upstreamError?.code === "INVALID_CREDENTIALS" ? "INVALID_CREDENTIALS" : "INVALID_SESSION";
    return { status, code, message: safeErrorMessages[code] };
  }

  if (status === 403) {
    const code = upstreamError?.code === "PROFILE_INACTIVE" ? "PROFILE_INACTIVE" : "FORBIDDEN";
    return {
      status,
      code,
      message: code === "PROFILE_INACTIVE" ? safeErrorMessages.PROFILE_INACTIVE : "No autorizado",
    };
  }

  if (status === 404 && upstreamError?.code === "USER_NOT_FOUND") {
    return { status, code: "USER_NOT_FOUND", message: safeErrorMessages.USER_NOT_FOUND };
  }

  if (status === 429) {
    return { status, code: "RATE_LIMITED", message: safeErrorMessages.RATE_LIMITED };
  }

  if (status === 405) {
    return { status, code: "METHOD_NOT_ALLOWED", message: safeErrorMessages.METHOD_NOT_ALLOWED };
  }

  return {
    status: 502,
    code: "AUTH_BACKEND_ERROR",
    message: "El servicio de autenticación no pudo completar la solicitud.",
  };
}

function errorResponse(error: SafeAuthError): NextResponse {
  return NextResponse.json(
    { error: { code: error.code, message: error.message } },
    {
      status: error.status,
      headers: { "cache-control": "no-store" },
    },
  );
}

function transportErrorResponse(error: AuthBackendTransportError): NextResponse {
  if (error.kind === "timeout") {
    return errorResponse({
      status: 504,
      code: "AUTH_BACKEND_TIMEOUT",
      message: "El servicio de autenticación tardó demasiado en responder.",
    });
  }

  return errorResponse({
    status: 503,
    code: "AUTH_BACKEND_UNAVAILABLE",
    message: "El servicio de autenticación no está disponible.",
  });
}

async function readJsonPayload(response: Response): Promise<unknown> {
  if (!isJsonContentType(response.headers.get("content-type"))) {
    throw new Error("INVALID_BACKEND_CONTENT_TYPE");
  }

  try {
    return await response.json();
  } catch {
    throw new Error("INVALID_BACKEND_JSON");
  }
}

function appendSetCookies(target: NextResponse, source: Response): void {
  for (const cookie of getSetCookieHeaders(source.headers)) {
    target.headers.append("set-cookie", cookie);
  }
}

export async function proxyAuthRequest(
  request: NextRequest,
  options: AuthProxyOptions,
): Promise<NextResponse> {
  let requestPayload: unknown;

  if (options.requestSchema) {
    try {
      const parsed = options.requestSchema.safeParse(await request.json());
      if (!parsed.success) return errorResponse(safeErrorForStatus(400, null));
      requestPayload = parsed.data;
    } catch {
      return errorResponse(safeErrorForStatus(400, null));
    }
  }

  const cookie = request.headers.get("cookie");
  const userAgent = request.headers.get("user-agent");
  const headers = new Headers();

  if (cookie) headers.set("cookie", cookie);
  if (userAgent) headers.set("user-agent", userAgent);
  if (options.requestSchema) headers.set("content-type", "application/json");

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetchAuthBackend(options.pathname, {
      method: options.method,
      headers,
      ...(options.requestSchema ? { body: JSON.stringify(requestPayload) } : {}),
    });
  } catch (error) {
    return transportErrorResponse(
      error instanceof AuthBackendTransportError
        ? error
        : new AuthBackendTransportError("unavailable"),
    );
  }

  if (upstreamResponse.status === 204) {
    if (!options.allowNoContent || !upstreamResponse.ok) {
      return errorResponse(safeErrorForStatus(502, null));
    }

    const response = new NextResponse(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
    appendSetCookies(response, upstreamResponse);
    return response;
  }

  let payload: unknown;

  try {
    payload = await readJsonPayload(upstreamResponse);
  } catch {
    const response = errorResponse(safeErrorForStatus(502, null));
    appendSetCookies(response, upstreamResponse);
    return response;
  }

  if (!upstreamResponse.ok) {
    const response = errorResponse(safeErrorForStatus(upstreamResponse.status, payload));
    appendSetCookies(response, upstreamResponse);
    return response;
  }

  if (options.responseSchema) {
    const parsed = options.responseSchema.safeParse(payload);
    if (!parsed.success) {
      const response = errorResponse(safeErrorForStatus(502, null));
      appendSetCookies(response, upstreamResponse);
      return response;
    }
    payload = parsed.data;
  }

  const response = NextResponse.json(payload, {
    status: upstreamResponse.status,
    headers: { "cache-control": "no-store" },
  });
  appendSetCookies(response, upstreamResponse);
  return response;
}
