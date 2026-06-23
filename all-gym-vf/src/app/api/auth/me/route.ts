import { NextRequest, NextResponse } from "next/server";
import { fetchAuthBackend, getSetCookieHeaders } from "@/lib/auth/backend-auth";

export async function GET(request: NextRequest) {
  const upstreamResponse = await fetchAuthBackend("/auth/me", {
    method: "GET",
    headers: request.headers.get("cookie") ? { cookie: request.headers.get("cookie") as string } : undefined,
  });

  const response = new NextResponse(await upstreamResponse.text(), {
    status: upstreamResponse.status,
    headers: {
      "content-type": upstreamResponse.headers.get("content-type") ?? "application/json",
    },
  });

  for (const cookie of getSetCookieHeaders(upstreamResponse.headers)) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
