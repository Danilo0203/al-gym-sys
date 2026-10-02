import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { after, test } from "node:test";

import { createOfflineGateway } from "./offline-gateway.mjs";

const upstream = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  response.setHeader("Set-Cookie", "session=local; Path=/; HttpOnly");
  response.setHeader("Content-Type", "application/octet-stream");
  response.end(Buffer.concat([
    Buffer.from(`${request.method} ${request.url} ${request.headers.cookie ?? ""}\n`),
    ...chunks,
  ]));
});
await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const upstreamPort = upstream.address().port;
const gateway = createOfflineGateway("127.0.0.1", upstreamPort);
await new Promise((resolve) => gateway.listen(0, "127.0.0.1", resolve));
const gatewayPort = gateway.address().port;

after(async () => {
  await Promise.all([
    new Promise((resolve) => gateway.close(resolve)),
    new Promise((resolve) => upstream.close(resolve)),
  ]);
});

test("reenvía ruta, sesión y bytes al servidor web fijo", async () => {
  const payload = Buffer.from([0, 1, 2, 255]);
  const response = await fetch(`http://127.0.0.1:${gatewayPort}/api/media/avatars/test.png?x=1`, {
    method: "POST",
    headers: { Cookie: "session=local" },
    body: payload,
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /session=local/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.concat([
    Buffer.from("POST /api/media/avatars/test.png?x=1 session=local\n"), payload,
  ]));
});

test("rechaza una URL absoluta para no actuar como proxy abierto", async () => {
  const status = await new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1", port: gatewayPort,
      path: "http://example.com/", method: "GET",
    }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    request.on("error", reject);
    request.end();
  });
  assert.equal(status, 400);
});

test("rechaza un Host externo", async () => {
  const status = await new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1", port: gatewayPort,
      path: "/api/health", headers: { Host: "remote.example" },
    }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    request.on("error", reject);
    request.end();
  });
  assert.equal(status, 400);
});
