import { NextRequest, NextResponse } from "next/server";
import { isSameOriginExport } from "./export-origin";
import { ExportVault } from "./export-vault";

const cookieName = "algym_hostinger_export";
const uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const jobPath = new RegExp(`^/jobs(?:/${uuid}(?:/(?:file|archive))?)?$`);
type Context = { params: Promise<{ segments?: string[] }> };
type Dependencies = {
  owner: (request: NextRequest) => Promise<string | null>;
  remote: (path: string, token: string | null, method: string, body?: string) => Promise<Response>;
  vault: ExportVault;
};
class RequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
const json = (status: number, data: unknown) => NextResponse.json(data, { status,
  headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
function setCookie(response: NextResponse, request: NextRequest, id: string, seconds: number) {
  response.cookies.set(cookieName, id, { httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:",
    path: "/api/windows-export", maxAge: seconds });
}
async function readBody(request: NextRequest, limit: number) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new RequestError(415, "Solicitud inválida.");
  const reader = request.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  if (reader) while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length; if (size > limit) { await reader.cancel(); throw new RequestError(413, "Solicitud demasiado grande."); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new RequestError(400, "Solicitud inválida."); }
}
function credentials(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestError(400, "Escribe el correo y la contraseña de Hostinger.");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !["email", "password"].includes(key)) || typeof data.email !== "string" ||
      data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()) ||
      typeof data.password !== "string" || !data.password || data.password.length > 256) {
    throw new RequestError(400, "Escribe el correo y la contraseña de Hostinger.");
  }
  return { email: data.email.trim().toLowerCase(), password: data.password };
}
export function createExportApi(deps: Dependencies) {
  return async function handle(request: NextRequest, context: Context) {
    const path = "/" + ((await context.params).segments ?? []).join("/");
    const allowed = request.method === "GET" ? path === "/session" || jobPath.test(path) :
      request.method === "POST" ? ["/session", "/jobs"].includes(path) : request.method === "DELETE" && path === "/session";
    if (!allowed) return json(404, { error: "Ruta no disponible." });
    if (request.method !== "GET" && !isSameOriginExport(request.headers.get("origin"), request.headers.get("host"), request.nextUrl.protocol)) {
      return json(403, { error: "Origen no permitido." });
    }
    try {
      const owner = await deps.owner(request);
      if (!owner) return json(403, { error: "Inicia sesión en AlGym con una cuenta propietaria activa." });
      const id = request.cookies.get(cookieName)?.value;
      const session = deps.vault.get(id, owner);
      const disconnect = (status: number, message?: string) => {
        deps.vault.drop(id, owner);
        const response = json(status, message ? { error: message } : { connected: false });
        setCookie(response, request, "", 0); return response;
      };
      if (path === "/session" && request.method === "DELETE") return disconnect(200);
      if (path === "/session") {
        const health = await deps.remote("/health", null, "GET");
        if (!health.ok || (await health.json()).nativeLogin !== true) {
          return json(503, { error: "El servicio de exportación de Hostinger necesita actualizarse para conectar desde Windows." });
        }
        if (request.method === "GET") return json(200, { connected: !!session, expiresAt: session?.expiresAt ?? null });
        const login = credentials(await readBody(request, 4096));
        const response = await deps.remote("/session", null, "POST", JSON.stringify(login));
        if (!response.ok) {
          const status = [400, 401, 403, 429].includes(response.status) ? response.status : 503;
          const message = status === 429 ? "Demasiados intentos. Espera un minuto." :
            status === 403 ? "Hostinger requiere una cuenta propietaria activa." :
            status === 503 ? "No fue posible conectar con Hostinger. Inténtalo más tarde." : "Revisa el correo y la contraseña de Hostinger.";
          return json(status, { error: message });
        }
        const data = await response.json();
        if (typeof data.accessToken !== "string" || data.accessToken.length > 16000 || !/^[A-Za-z0-9_.-]+$/.test(data.accessToken) ||
            typeof data.expiresAt !== "number") throw new Error("Invalid remote session");
        deps.vault.drop(id, owner);
        const saved = deps.vault.put(owner, { accessToken: data.accessToken, expiresAt: data.expiresAt });
        const result = json(200, { connected: true, expiresAt: saved.expiresAt });
        setCookie(result, request, saved.id, Math.max(1, Math.floor((saved.expiresAt - Date.now()) / 1000)));
        return result;
      }
      if (!session) return disconnect(401, "Conecta de nuevo tu cuenta de Hostinger para exportar.");
      const body = request.method === "POST" ? JSON.stringify(await readBody(request, 1024)) : undefined;
      const response = await deps.remote(path, session.accessToken, request.method, body);
      if ([401, 403].includes(response.status)) return disconnect(401, "La cuenta de Hostinger ya no está autorizada. Conéctala de nuevo.");
      if (response.status >= 300 && response.status < 400) return json(502, { error: "Respuesta de exportación inválida." });
      return response;
    } catch (error) {
      if (error instanceof RequestError) return json(error.status, { error: error.message });
      return json(503, { error: "La exportación no está disponible en este momento. Revisa la conexión a internet e inténtalo de nuevo." });
    }
  };
}
