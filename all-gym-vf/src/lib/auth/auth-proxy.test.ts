import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { POST as changePassword } from "@/app/api/auth/change-password/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as getSession } from "@/app/api/auth/me/route";
import { AuthBackendTransportError, fetchAuthBackend } from "@/lib/auth/backend-auth";

process.env.ALGYM_BACKEND_URL = "http://127.0.0.1:4000";

const originalFetch = globalThis.fetch;

const authContext = {
  user: {
    id: "2d487dd4-e267-4fb6-910b-e087b604b8d5",
    email: "usuario@example.com",
    profile: {
      fullName: "Usuario de Prueba",
      role: "employee",
      isActive: true,
    },
  },
  authorization: {
    roleSlug: "employee",
    scope: "panel",
    permissions: ["customers.view"],
    isOwner: false,
  },
};

function jsonResponse(payload: unknown, status = 200, cookies: string[] = []): Response {
  const headers = new Headers({ "content-type": "application/json" });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(payload), { status, headers });
}

function nextRequest(
  pathname: string,
  options: { method?: "GET" | "POST"; body?: unknown; cookie?: string } = {},
): NextRequest {
  const headers = new Headers();
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);

  return new NextRequest(`http://localhost${pathname}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

async function withMockFetch<T>(
  mock: typeof fetch,
  callback: () => Promise<T>,
): Promise<T> {
  globalThis.fetch = mock;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("login exitoso reenvía solo credenciales y propaga la cookie de sesión", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;

  const response = await withMockFetch(
    (async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse(authContext, 200, ["algym_session=abc; Path=/; HttpOnly; SameSite=Lax"]);
    }) as typeof fetch,
    () =>
      login(
        nextRequest("/api/auth/login", {
          method: "POST",
          body: { email: " USUARIO@EXAMPLE.COM ", password: "secreto" },
        }),
      ),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), authContext);
  assert.equal(capturedUrl, "http://127.0.0.1:4000/auth/login");
  assert.equal(capturedInit?.cache, "no-store");
  assert.equal(capturedInit?.redirect, "manual");
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    email: "usuario@example.com",
    password: "secreto",
  });
  assert.match(response.headers.get("set-cookie") ?? "", /algym_session=abc/);
});

test("login conserva 401 y sanea credenciales inválidas", async () => {
  const response = await withMockFetch(
    (async () =>
      jsonResponse(
        { error: { code: "INVALID_CREDENTIALS", message: "detalle interno" } },
        401,
      )) as typeof fetch,
    () =>
      login(
        nextRequest("/api/auth/login", {
          method: "POST",
          body: { email: "usuario@example.com", password: "incorrecta" },
        }),
      ),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: { code: "INVALID_CREDENTIALS", message: "Credenciales inválidas" },
  });
});

test("login rechaza identidad y autorización controladas por el navegador", async () => {
  let called = false;
  const response = await withMockFetch(
    (async () => {
      called = true;
      return jsonResponse(authContext);
    }) as typeof fetch,
    () =>
      login(
        nextRequest("/api/auth/login", {
          method: "POST",
          body: {
            email: "usuario@example.com",
            password: "secreto",
            userId: authContext.user.id,
            role: "owner",
            permissions: ["roles.update"],
            scope: "panel",
            isOwner: true,
          },
        }),
      ),
  );

  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.deepEqual(await response.json(), {
    error: { code: "VALIDATION_ERROR", message: "Solicitud inválida" },
  });
});

test("auth/me autenticado reenvía la cookie y valida el contrato", async () => {
  let forwardedCookie: string | null = null;
  const response = await withMockFetch(
    (async (_input, init) => {
      forwardedCookie = new Headers(init?.headers).get("cookie");
      return jsonResponse(authContext);
    }) as typeof fetch,
    () => getSession(nextRequest("/api/auth/me", { cookie: "algym_session=abc; theme=dark" })),
  );

  assert.equal(response.status, 200);
  assert.equal(forwardedCookie, "algym_session=abc; theme=dark");
  assert.deepEqual(await response.json(), authContext);
});

test("auth/me sin sesión conserva 401 saneado", async () => {
  const response = await withMockFetch(
    (async () =>
      jsonResponse({ error: { code: "INVALID_SESSION", message: "Sesión inválida" } }, 401)) as typeof fetch,
    () => getSession(nextRequest("/api/auth/me")),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: { code: "INVALID_SESSION", message: "Sesión inválida" },
  });
});

test("logout maneja 204 sin parsear JSON y propaga varios Set-Cookie", async () => {
  const headers = new Headers();
  headers.append("set-cookie", "algym_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  headers.append("set-cookie", "legacy_session=; Path=/; Max-Age=0");

  const response = await withMockFetch(
    (async () => new Response(null, { status: 204, headers })) as typeof fetch,
    () => logout(nextRequest("/api/auth/logout", { method: "POST", cookie: "algym_session=abc" })),
  );

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  const setCookies = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  assert.equal(setCookies.length, 2);
});

test("cambio de contraseña reenvía solo contraseña actual y nueva", async () => {
  let forwardedBody: unknown;
  const response = await withMockFetch(
    (async (_input, init) => {
      forwardedBody = JSON.parse(String(init?.body));
      return jsonResponse(
        { success: true, message: "Contraseña actualizada correctamente" },
        200,
        ["algym_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"],
      );
    }) as typeof fetch,
    () =>
      changePassword(
        nextRequest("/api/auth/change-password", {
          method: "POST",
          cookie: "algym_session=abc",
          body: { currentPassword: "Anterior123", newPassword: "NuevaClave123" },
        }),
      ),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(forwardedBody, {
    currentPassword: "Anterior123",
    newPassword: "NuevaClave123",
  });
  assert.doesNotMatch(JSON.stringify(forwardedBody), /confirm|userId|role|scope|permissions|isOwner/i);
  assert.match(response.headers.get("set-cookie") ?? "", /algym_session=/);
});

test("respuesta no JSON se convierte en error saneado", async () => {
  const response = await withMockFetch(
    (async () =>
      new Response("<html>internal stack</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as typeof fetch,
    () => getSession(nextRequest("/api/auth/me", { cookie: "algym_session=abc" })),
  );

  assert.equal(response.status, 502);
  assert.doesNotMatch(JSON.stringify(await response.json()), /internal stack|html/i);
});

test("backend no disponible se distingue con 503", async () => {
  const response = await withMockFetch(
    (async () => {
      throw new TypeError("connect ECONNREFUSED 127.0.0.1:4000");
    }) as typeof fetch,
    () => getSession(nextRequest("/api/auth/me", { cookie: "algym_session=abc" })),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: {
      code: "AUTH_BACKEND_UNAVAILABLE",
      message: "El servicio de autenticación no está disponible.",
    },
  });
});

test("ALGYM_BACKEND_URL rechaza protocolos y credenciales inseguros", async () => {
  const originalBackendUrl = process.env.ALGYM_BACKEND_URL;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return jsonResponse(authContext);
  }) as typeof fetch;

  try {
    for (const invalidUrl of ["javascript:alert(1)", "http://user:secret@127.0.0.1:4000"]) {
      process.env.ALGYM_BACKEND_URL = invalidUrl;
      await assert.rejects(
        fetchAuthBackend("/auth/me"),
        (error: unknown) => error instanceof AuthBackendTransportError && error.kind === "unavailable",
      );
    }
    assert.equal(called, false);
  } finally {
    process.env.ALGYM_BACKEND_URL = originalBackendUrl;
    globalThis.fetch = originalFetch;
  }
});

test("timeout aborta el transporte y no expone el error interno", async () => {
  await withMockFetch(
    ((_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("socket debug details")), {
          once: true,
        });
      })) as typeof fetch,
    async () => {
      await assert.rejects(
        fetchAuthBackend("/auth/me", {}, 5),
        (error: unknown) =>
          error instanceof AuthBackendTransportError && error.kind === "timeout" && !error.message.includes("socket"),
      );
    },
  );
});

test("error interno del backend no devuelve stack ni cuerpo interno", async () => {
  const response = await withMockFetch(
    (async () =>
      jsonResponse(
        {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "password=secret stack at auth.service.ts:10",
            details: { stack: "sensitive" },
          },
        },
        500,
      )) as typeof fetch,
    () => getSession(nextRequest("/api/auth/me", { cookie: "algym_session=abc" })),
  );

  assert.equal(response.status, 502);
  const serialized = JSON.stringify(await response.json());
  assert.doesNotMatch(serialized, /password|secret|stack|auth\.service/i);
  assert.match(serialized, /AUTH_BACKEND_ERROR/);
});
