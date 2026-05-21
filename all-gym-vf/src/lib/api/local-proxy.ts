import { NextResponse, type NextRequest } from "next/server";
import { getApiInternalUrl } from "@/lib/auth/local-auth-server";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "content-encoding",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

function copyHeaders(source: Headers, target: Headers) {
  source.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase()) || key.toLowerCase() === "set-cookie") {
      return;
    }

    target.set(key, value);
  });
}

export async function proxyLocalApiRequest(request: NextRequest, pathname: string) {
  const apiInternalUrl = getApiInternalUrl();
  if (!apiInternalUrl) {
    return NextResponse.json(
      {
        error: "local_api_not_configured",
        message: "API_INTERNAL_URL is not configured"
      },
      { status: 503 }
    );
  }

  const headers = new Headers();
  copyHeaders(request.headers, headers);
  headers.set("Accept", "application/json");

  const requestInit: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
    redirect: "manual"
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    requestInit.body = await request.text();
  }

  const upstreamResponse = await fetch(`${apiInternalUrl}${pathname}`, requestInit);
  const responseHeaders = new Headers();
  copyHeaders(upstreamResponse.headers, responseHeaders);

  const setCookies = upstreamResponse.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    for (const cookie of setCookies) {
      responseHeaders.append("set-cookie", cookie);
    }
  } else {
    const singleCookie = upstreamResponse.headers.get("set-cookie");
    if (singleCookie) {
      responseHeaders.append("set-cookie", singleCookie);
    }
  }

  const hasEmptyBodyStatus =
    upstreamResponse.status === 204 || upstreamResponse.status === 205 || upstreamResponse.status === 304;
  const bodyText = hasEmptyBodyStatus ? null : await upstreamResponse.text();

  return new NextResponse(bodyText, {
    status: upstreamResponse.status,
    headers: responseHeaders
  });
}
