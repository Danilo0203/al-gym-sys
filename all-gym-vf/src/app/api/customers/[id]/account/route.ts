import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchAuthBackend } from "@/lib/auth/backend-auth";
import {
  customerDetailSchema,
  updateCustomerAccountInputSchema,
} from "@/features/customers/lib/local-customers";

interface CustomerAccountRouteContext {
  params: Promise<{ id: string }>;
}

const customerIdSchema = z.uuid();
const backendErrorSchema = z.object({
  error: z.object({
    code: z.string(),
  }).passthrough(),
}).passthrough();

const safeErrors = {
  VALIDATION_ERROR: "Revisa los datos ingresados.",
  PASSWORD_REQUIRES_EMAIL: "La contraseña requiere un correo configurado.",
  UNAUTHORIZED: "Tu sesión expiró. Vuelve a iniciar sesión.",
  INVALID_SESSION: "Tu sesión expiró. Vuelve a iniciar sesión.",
  FORBIDDEN: "No tienes autorización para administrar esta cuenta.",
  CUSTOMER_NOT_FOUND: "Cliente no encontrado.",
  EMAIL_ALREADY_EXISTS: "El correo ya está utilizado por otra cuenta.",
} as const;

export async function PATCH(request: NextRequest, context: CustomerAccountRouteContext) {
  const { id: rawId } = await context.params;
  const parsedId = customerIdSchema.safeParse(rawId);

  if (!parsedId.success) {
    return safeErrorResponse(400, "VALIDATION_ERROR", "Revisa los datos ingresados.");
  }

  let requestPayload: unknown;
  try {
    requestPayload = await request.json();
  } catch {
    return safeErrorResponse(400, "VALIDATION_ERROR", "Revisa los datos ingresados.");
  }

  const parsedRequest = updateCustomerAccountInputSchema.safeParse(requestPayload);
  if (!parsedRequest.success) {
    return safeErrorResponse(400, "VALIDATION_ERROR", "Revisa los datos ingresados.");
  }

  const cookieHeader = request.headers.get("cookie");

  try {
    const upstreamResponse = await fetchAuthBackend(`/customers/${parsedId.data}/account`, {
      method: "PATCH",
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        "content-type": "application/json",
      },
      body: JSON.stringify(parsedRequest.data),
      cache: "no-store",
    });
    const responseText = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      return mapBackendError(upstreamResponse.status, responseText);
    }

    let responsePayload: unknown;
    try {
      responsePayload = JSON.parse(responseText);
    } catch {
      return safeErrorResponse(502, "INVALID_UPSTREAM_RESPONSE", "Error inesperado.");
    }

    const parsedResponse = customerDetailSchema.safeParse(responsePayload);
    if (!parsedResponse.success) {
      console.error("Invalid customer account response contract");
      return safeErrorResponse(502, "INVALID_UPSTREAM_CONTRACT", "Error inesperado.");
    }

    return NextResponse.json(parsedResponse.data, {
      status: upstreamResponse.status,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return safeErrorResponse(500, "INTERNAL_ERROR", "Error inesperado.");
  }
}

function mapBackendError(status: number, responseText: string) {
  let code: string | null = null;

  try {
    const parsed = backendErrorSchema.safeParse(JSON.parse(responseText));
    code = parsed.success ? parsed.data.error.code : null;
  } catch {
    code = null;
  }

  if (code && code in safeErrors) {
    return safeErrorResponse(status, code, safeErrors[code as keyof typeof safeErrors]);
  }

  if (status === 401) return safeErrorResponse(status, "UNAUTHORIZED", "Tu sesión expiró. Vuelve a iniciar sesión.");
  if (status === 403) return safeErrorResponse(status, "FORBIDDEN", "No tienes autorización para administrar esta cuenta.");
  if (status === 404) return safeErrorResponse(status, "CUSTOMER_NOT_FOUND", "Cliente no encontrado.");
  if (status === 409) return safeErrorResponse(status, "EMAIL_ALREADY_EXISTS", "El correo ya está utilizado por otra cuenta.");
  if (status >= 500) return safeErrorResponse(status, "INTERNAL_ERROR", "Error inesperado.");

  return safeErrorResponse(status, "VALIDATION_ERROR", "Revisa los datos ingresados.");
}

function safeErrorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { "cache-control": "no-store" } },
  );
}
