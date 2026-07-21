import { NextRequest, NextResponse } from "next/server";
import { fetchAuthBackend, getSetCookieHeaders } from "@/lib/auth/backend-auth";

export async function POST(request: NextRequest) {
  const upstreamResponse = await fetchAuthBackend("/auth/login", {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
      ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie") as string } : {}),
    },
    body: await request.text(),
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
