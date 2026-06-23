import { NextRequest, NextResponse } from "next/server";
import { fetchAuthBackend, getSetCookieHeaders } from "@/lib/auth/backend-auth";

export async function POST(request: NextRequest) {
  const upstreamResponse = await fetchAuthBackend("/auth/logout", {
    method: "POST",
    headers: request.headers.get("cookie") ? { cookie: request.headers.get("cookie") as string } : undefined,
    body: await request.text(),
  });

  const responseBody = upstreamResponse.status === 204 ? null : await upstreamResponse.text();
  const response = new NextResponse(responseBody, {
    status: upstreamResponse.status,
    headers:
      upstreamResponse.status === 204
        ? undefined
        : upstreamResponse.headers.get("content-type")
          ? {
              "content-type": upstreamResponse.headers.get("content-type") as string,
            }
          : undefined,
  });

  for (const cookie of getSetCookieHeaders(upstreamResponse.headers)) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
