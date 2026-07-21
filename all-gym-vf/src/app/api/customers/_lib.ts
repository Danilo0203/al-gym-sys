import { NextRequest, NextResponse } from "next/server";
import { fetchAuthBackend } from "@/lib/auth/backend-auth";

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
