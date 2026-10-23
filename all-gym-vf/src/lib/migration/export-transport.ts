import https from "node:https";
import config from "./hostinger-config.json";
import { Readable } from "node:stream";

export async function requestExportService(path: string, token: string | null, method: string, body?: string): Promise<Response> {
  const override = process.env.ALGYM_EXPORT_URL || process.env.ALGYM_EXPORT_CA_BASE64;
  const endpoint = override ? process.env.ALGYM_EXPORT_URL : config.url;
  const certificate = override ? process.env.ALGYM_EXPORT_CA_BASE64 : config.caBase64;
  if (!endpoint || !certificate) throw new Error("Exportador no configurado.");
  const base = new URL(endpoint);
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) throw new Error("Configuración de exportación inválida.");
  return new Promise((resolve, reject) => {
    // Trust only this deployment's CA and keep normal hostname/date checks enabled.
    const req = https.request(new URL(path, base), {
      method, ca: Buffer.from(certificate, "base64"), rejectUnauthorized: true,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) } : {}) },
      timeout: 15000,
    }, response => {
      const headers = new Headers();
      for (const key of ["content-type", "content-length", "content-disposition"]) {
        const value = response.headers[key]; if (typeof value === "string") headers.set(key, value);
      }
      headers.set("cache-control", "no-store, private"); headers.set("x-content-type-options", "nosniff");
      resolve(new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, { status: response.statusCode ?? 502, headers }));
    });
    req.on("timeout", () => req.destroy(new Error("Tiempo de espera agotado.")));
    req.on("error", reject); req.end(body);
  });
}
