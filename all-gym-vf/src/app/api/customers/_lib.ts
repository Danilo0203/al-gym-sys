import { NextRequest, NextResponse } from "next/server";
import { fetchAuthBackend } from "@/lib/auth/backend-auth";
import type { ZodType } from "zod";

const JSON_CONTENT_TYPE = "application/json";
const SAFE_CUSTOMER_ERROR_CODES = new Set([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "INVALID_SESSION",
  "FORBIDDEN",
  "CUSTOMER_NOT_FOUND",
  "BODY_ASSESSMENT_NOT_FOUND",
]);

function sensitiveProxyError(status: number, code?: string) {
  const safeCode = code && SAFE_CUSTOMER_ERROR_CODES.has(code)
    ? code
    : status >= 500
      ? "UPSTREAM_ERROR"
      : "REQUEST_FAILED";
  const messages: Record<string, string> = {
    VALIDATION_ERROR: "Revisa los datos ingresados.",
    UNAUTHORIZED: "Tu sesión expiró. Vuelve a iniciar sesión.",
    INVALID_SESSION: "Tu sesión expiró. Vuelve a iniciar sesión.",
    FORBIDDEN: "No tienes autorización para realizar esta operación.",
    CUSTOMER_NOT_FOUND: "Cliente no encontrado.",
    BODY_ASSESSMENT_NOT_FOUND: "Evaluación corporal no encontrada.",
    UPSTREAM_ERROR: "No fue posible completar la operación.",
    REQUEST_FAILED: "No fue posible completar la operación.",
  };
  return NextResponse.json(
    { error: { code: safeCode, message: messages[safeCode] } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

async function parseSafeErrorCode(responseText: string): Promise<string | undefined> {
  try {
    const payload: unknown = JSON.parse(responseText);
    if (!payload || typeof payload !== "object" || !("error" in payload)) return undefined;
    const error = payload.error;
    if (!error || typeof error !== "object" || !("code" in error)) return undefined;
    return typeof error.code === "string" ? error.code : undefined;
  } catch {
    return undefined;
  }
}

export async function proxyCustomersRequest(
  request: NextRequest,
  pathname: string,
  options: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    allowedSearchParams?: string[];
    withJsonBody?: boolean;
  },
) {
  const upstreamPath = buildUpstreamPath(pathname, request.nextUrl, options.allowedSearchParams);
  const upstreamHeaders = new Headers();
  const cookieHeader = request.headers.get("cookie");

  if (cookieHeader) {
    upstreamHeaders.set("cookie", cookieHeader);
  }

  let body: string | undefined;

  if (options.withJsonBody) {
    body = await request.text();
    upstreamHeaders.set("content-type", JSON_CONTENT_TYPE);
  }

  const upstreamResponse = await fetchAuthBackend(upstreamPath, {
    method: options.method,
    headers: upstreamHeaders,
    body,
    cache: "no-store",
  });

  const responseBody = [204, 205, 304].includes(upstreamResponse.status)
    ? null
    : await upstreamResponse.text();

  return new NextResponse(responseBody, {
    status: upstreamResponse.status,
    headers: {
      "cache-control": "no-store",
      "content-type": upstreamResponse.headers.get("content-type") ?? JSON_CONTENT_TYPE,
    },
  });
}

export async function proxyValidatedCustomersGet<T>(
  request: NextRequest,
  pathname: string,
  schema: ZodType<T>,
  allowedSearchParams: string[] = [],
) {
  const upstreamPath = buildUpstreamPath(pathname, request.nextUrl, allowedSearchParams);
  const cookieHeader = request.headers.get("cookie");
  const upstreamResponse = await fetchAuthBackend(upstreamPath, {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });
  const responseText = await upstreamResponse.text();

  if (!upstreamResponse.ok) {
    return new NextResponse(responseText, {
      status: upstreamResponse.status,
      headers: {
        "cache-control": "no-store",
        "content-type": upstreamResponse.headers.get("content-type") ?? JSON_CONTENT_TYPE,
      },
    });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_UPSTREAM_RESPONSE", message: "El backend devolvió JSON inválido." } },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_UPSTREAM_CONTRACT", message: "El backend devolvió un contrato incompatible." } },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(parsed.data, {
    status: upstreamResponse.status,
    headers: { "cache-control": "no-store" },
  });
}

export async function proxySensitiveCustomersGet<T>(
  request: NextRequest,
  pathname: string,
  schema: ZodType<T>,
  allowedSearchParams: string[] = [],
) {
  const upstreamPath = buildUpstreamPath(pathname, request.nextUrl, allowedSearchParams);
  const cookieHeader = request.headers.get("cookie");
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchAuthBackend(upstreamPath, {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
  } catch {
    return sensitiveProxyError(502, "UPSTREAM_ERROR");
  }
  const responseText = await upstreamResponse.text();

  if (!upstreamResponse.ok) {
    return sensitiveProxyError(upstreamResponse.status, await parseSafeErrorCode(responseText));
  }

  try {
    const parsed = schema.safeParse(JSON.parse(responseText));
    if (!parsed.success) {
      return sensitiveProxyError(502, "UPSTREAM_ERROR");
    }
    return NextResponse.json(parsed.data, {
      status: upstreamResponse.status,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return sensitiveProxyError(502, "UPSTREAM_ERROR");
  }
}

export async function proxySensitiveCustomersMutation<TInput, TOutput>(
  request: NextRequest,
  pathname: string,
  options: {
    method: "POST" | "PATCH";
    inputSchema: ZodType<TInput>;
    responseSchema: ZodType<TOutput>;
  },
) {
  let requestPayload: unknown;
  try {
    requestPayload = await request.json();
  } catch {
    return sensitiveProxyError(400, "VALIDATION_ERROR");
  }

  const parsedRequest = options.inputSchema.safeParse(requestPayload);
  if (!parsedRequest.success) {
    return sensitiveProxyError(400, "VALIDATION_ERROR");
  }

  const cookieHeader = request.headers.get("cookie");
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchAuthBackend(pathname, {
      method: options.method,
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        "content-type": JSON_CONTENT_TYPE,
      },
      body: JSON.stringify(parsedRequest.data),
      cache: "no-store",
    });
  } catch {
    return sensitiveProxyError(502, "UPSTREAM_ERROR");
  }
  const responseText = await upstreamResponse.text();

  if (!upstreamResponse.ok) {
    return sensitiveProxyError(upstreamResponse.status, await parseSafeErrorCode(responseText));
  }

  try {
    const parsedResponse = options.responseSchema.safeParse(JSON.parse(responseText));
    if (!parsedResponse.success) {
      return sensitiveProxyError(502, "UPSTREAM_ERROR");
    }
    return NextResponse.json(parsedResponse.data, {
      status: upstreamResponse.status,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return sensitiveProxyError(502, "UPSTREAM_ERROR");
  }
}

export function invalidSensitiveCustomersRequest() {
  return sensitiveProxyError(400, "VALIDATION_ERROR");
}

function buildUpstreamPath(pathname: string, nextUrl: URL, allowedSearchParams: string[] = []) {
  const searchParams = new URLSearchParams();

  for (const key of allowedSearchParams) {
    const value = nextUrl.searchParams.get(key);
    if (value !== null) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
