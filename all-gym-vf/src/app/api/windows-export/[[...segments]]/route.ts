import { NextRequest } from "next/server";
import { getExportOwner } from "@/lib/migration/owner";
import { isSameOriginExport } from "@/lib/migration/export-origin";
import { requestExportService } from "@/lib/migration/export-transport";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (status: number, error: string) => Response.json({ error }, { status, headers: { "cache-control": "no-store, private" } });
async function proxy(request: NextRequest, context: { params: Promise<{ segments?: string[] }> }) {
  const path = "/" + ((await context.params).segments ?? []).join("/");
  if (!/^\/jobs(?:\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:\/(?:file|archive))?)?$/.test(path) ||
    (request.method === "POST" && path !== "/jobs")) return json(404, "Ruta no disponible.");
  if (request.method === "POST" && !isSameOriginExport(request.headers.get("origin"), request.headers.get("host"), request.nextUrl.protocol)) {
    return json(403, "Origen no permitido.");
  }
  try {
    const owner = await getExportOwner();
    if (!owner) return json(403, "Inicia sesión con una cuenta propietaria activa.");
    let body: string | undefined;
    if (request.method === "POST") {
      if (!request.headers.get("content-type")?.startsWith("application/json")) return json(415, "Solicitud inválida.");
      const reader = request.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      if (reader) { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length;
        if (size > 1024) { await reader.cancel(); return json(413, "Solicitud demasiado grande."); } chunks.push(value); } }
      body = Buffer.concat(chunks).toString("utf8");
    }
    return await requestExportService(path, owner.token, request.method, body);
  } catch { return json(503, "La exportación no está disponible en este momento. Revisa la conexión o la configuración del equipo."); }
}
export const GET = proxy;
export const POST = proxy;
