import { NextRequest, NextResponse } from "next/server";
import { fetchAuthBackend, getSetCookieHeaders } from "@/lib/auth/backend-auth";

export async function POST(request: NextRequest) {
  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetchAuthBackend("/auth/change-password", {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
        ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie") as string } : {}),
      },
      body: await request.text(),
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "No fue posible conectar con el backend local.",
        },
      },
      { status: 503 },
    );
  }

  const response = new NextResponse(await upstreamResponse.text(), {
    status: upstreamResponse.status,
    headers: upstreamResponse.headers.get("content-type")
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
