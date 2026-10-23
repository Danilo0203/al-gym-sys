import { NextRequest, NextResponse } from "next/server";
import { fetchAuthBackend } from "@/lib/auth/backend-auth";

export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ segments?: string[] }> };
async function proxy(request: NextRequest, context: Context) {
  const segments = (await context.params).segments ?? [];
  const suffix = segments.join("/");
  const id = "[a-f0-9-]{36}";
  const allowed = request.method === "GET" ? suffix === "" :
    suffix === "packages" || new RegExp(`^packages/${id}/(import|review|update)$`).test(suffix) || new RegExp(`^jobs/${id}/status$`).test(suffix);
  if (!allowed) return NextResponse.json({ error: { message: "Ruta no encontrada." } }, { status: 404 });
  const origin = request.headers.get("origin");
  // This streaming endpoint bypasses Next Proxy's body buffering. Enforce CSRF here.
  let sameOrigin = false;
  try { sameOrigin = !!origin && ["http:", "https:"].includes(new URL(origin).protocol) &&
    new URL(origin).host === (request.headers.get("host") ?? request.nextUrl.host); } catch { /* Invalid origin. */ }
  if (request.method !== "GET" && !sameOrigin) {
    return NextResponse.json({ error: { message: "Origen no permitido." } }, { status: 403 });
  }
  const headers = new Headers();
  for (const name of ["cookie", "origin", "content-type", "content-length", "x-algym-import-token"]) {
    const value = request.headers.get(name); if (value) headers.set(name, value);
  }
  try {
    const init: RequestInit & { duplex?: "half" } = { method: request.method, headers, signal: request.signal };
    if (request.method !== "GET") { init.body = request.body; init.duplex = "half"; }
    const response = await fetchAuthBackend(`/system/migration${suffix ? `/${suffix}` : ""}`, init, 300000);
    return new NextResponse(await response.text(), {
      status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: { message: "El sistema se está reconectando. Espera un momento." } }, { status: 503 });
  }
}
export const GET = proxy;
export const POST = proxy;
