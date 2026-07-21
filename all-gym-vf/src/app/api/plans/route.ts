import { NextRequest, NextResponse } from "next/server";

import { fetchAuthBackend } from "@/lib/auth/backend-auth";

const JSON_CONTENT_TYPE = "application/json";

export async function GET(request: NextRequest) {
  const headers = new Headers();
  const cookieHeader = request.headers.get("cookie");

  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const upstreamResponse = await fetchAuthBackend("/plans", {
    method: "GET",
    headers,
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
