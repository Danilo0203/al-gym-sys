import { NextRequest, NextResponse } from "next/server";
import { fetchAuthBackend } from "@/lib/auth/backend-auth";

const JSON_CONTENT_TYPE = "application/json";

export async function GET(request: NextRequest) {
  const upstreamHeaders = new Headers();
  const cookieHeader = request.headers.get("cookie");

  if (cookieHeader) {
    upstreamHeaders.set("cookie", cookieHeader);
  }

  const searchParams = request.nextUrl.search;
  const upstreamResponse = await fetchAuthBackend(`/plans${searchParams}`, {
    method: "GET",
    headers: upstreamHeaders,
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
