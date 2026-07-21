import { NextRequest, NextResponse } from "next/server";
import { fetchAuthBackend } from "@/lib/auth/backend-auth";

export async function GET(request: NextRequest) {
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const upstream = await fetchAuthBackend(`/plans${request.nextUrl.search}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      "cache-control": "no-store",
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
