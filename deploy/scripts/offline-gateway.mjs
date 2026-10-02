import { createServer, request as httpRequest } from "node:http";
import { fileURLToPath } from "node:url";

export function createOfflineGateway(host = "web", port = 3000) {
  return createServer((incoming, outgoing) => {
    const path = incoming.url ?? "";
    const hostHeader = incoming.headers.host ?? "";
    if (!path.startsWith("/") || path.startsWith("//")
      || !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(hostHeader)) {
      outgoing.writeHead(400).end("Ruta inválida");
      return;
    }

    const headers = { ...incoming.headers };
    delete headers["proxy-connection"];
    delete headers.connection;
    const upstream = httpRequest({
      hostname: host,
      port,
      path,
      method: incoming.method,
      headers,
      timeout: 30000,
    }, (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    });
    upstream.on("timeout", () => upstream.destroy(new Error("Tiempo de espera agotado")));
    upstream.on("error", () => {
      if (!outgoing.headersSent) outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(upstream);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createOfflineGateway().listen(3000, "0.0.0.0");
}
