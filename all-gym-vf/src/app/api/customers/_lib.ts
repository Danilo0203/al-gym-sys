import { NextRequest, NextResponse } from "next/server";
import { fetchAuthBackend } from "@/lib/auth/backend-auth";
import type { ZodType } from "zod";

const JSON_CONTENT_TYPE = "application/json";

export async function proxyCustomersRequest(
  request: NextRequest,
  pathname: string,
  options: {
    method: "GET" | "POST" | "PATCH";
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

  return new NextResponse(await upstreamResponse.text(), {
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
    console.error("Invalid Customers backend contract", parsed.error.flatten());
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
