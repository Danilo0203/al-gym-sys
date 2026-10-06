import { NextResponse, type NextRequest } from "next/server";

import { AuthBackendTransportError, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { authContextSchema, getAuthError, isJsonContentType } from "@/lib/auth/contracts";
import { parseUserRole, resolvePostLoginRoute } from "@/lib/auth/role-utils";

const safeApiMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function isForeignApiMutation(request: NextRequest): boolean {
  if (safeApiMethods.has(request.method)) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const requestHost = request.headers.get("host") ?? request.nextUrl.host;
    return !["http:", "https:"].includes(originUrl.protocol) || originUrl.host !== requestHost;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (pathname.startsWith("/api/")) {
    if (isForeignApiMutation(request)) {
      return NextResponse.json(
        { error: { code: "INVALID_ORIGIN", message: "Origen no permitido" } },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
    return response;
  }

  const isProtectedArea = pathname.startsWith("/panel") || pathname.startsWith("/mi");
  let authResponse: Response;

  try {
    authResponse = await fetchAuthBackend("/auth/me", {
      method: "GET",
      headers: request.headers.get("cookie")
        ? { cookie: request.headers.get("cookie") as string }
        : undefined,
    });
  } catch (error) {
    if (!isProtectedArea) return response;

    const isTimeout = error instanceof AuthBackendTransportError && error.kind === "timeout";
    return NextResponse.json(
      {
        error: {
          code: isTimeout ? "AUTH_BACKEND_TIMEOUT" : "AUTH_BACKEND_UNAVAILABLE",
          message: isTimeout
            ? "El servicio de autenticación tardó demasiado en responder."
            : "El servicio de autenticación no está disponible.",
        },
      },
      { status: isTimeout ? 504 : 503 },
    );
  }

  if (authResponse.status === 401) {
    if (!isProtectedArea) return response;

    const url = request.nextUrl.clone();
    url.pathname = "/iniciar-sesion";
    return NextResponse.redirect(url);
  }

  if (!isJsonContentType(authResponse.headers.get("content-type"))) {
    return isProtectedArea
      ? NextResponse.json(
          { error: { code: "AUTH_BACKEND_ERROR", message: "No fue posible validar la sesión local." } },
          { status: 502 },
        )
      : response;
  }

  let payload: unknown;
  try {
    payload = await authResponse.json();
  } catch {
    return isProtectedArea
      ? NextResponse.json(
          { error: { code: "AUTH_BACKEND_ERROR", message: "No fue posible validar la sesión local." } },
          { status: 502 },
        )
      : response;
  }

  if (!authResponse.ok) {
    const backendError = getAuthError(payload);
    if (authResponse.status === 403 && backendError?.code === "PROFILE_INACTIVE") {
      return NextResponse.json(
        { error: { code: "PROFILE_INACTIVE", message: "Perfil inactivo" } },
        { status: 403 },
      );
    }

    return isProtectedArea
      ? NextResponse.json(
          { error: { code: "AUTH_BACKEND_ERROR", message: "No fue posible validar la sesión local." } },
          { status: 502 },
        )
      : response;
  }

  const parsedContext = authContextSchema.safeParse(payload);
  if (!parsedContext.success) {
    return isProtectedArea
      ? NextResponse.json(
          { error: { code: "AUTH_BACKEND_ERROR", message: "No fue posible validar la sesión local." } },
          { status: 502 },
        )
      : response;
  }

  const authContext = parsedContext.data;
  const role = parseUserRole(authContext.authorization.roleSlug);
  const defaultRoute = resolvePostLoginRoute({
    role,
    roleScope: authContext.authorization.scope,
    permissions: authContext.authorization.permissions,
    isOwner: authContext.authorization.isOwner,
  });
  const requestedPath = `${pathname}${request.nextUrl.search}`;
  const resolvedRequestedPath = resolvePostLoginRoute({
    role,
    roleScope: authContext.authorization.scope,
    permissions: authContext.authorization.permissions,
    isOwner: authContext.authorization.isOwner,
    requestedPath,
  });

  if (pathname.startsWith("/iniciar-sesion")) {
    const url = request.nextUrl.clone();
    url.pathname = defaultRoute;
    return NextResponse.redirect(url);
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = defaultRoute;
    return NextResponse.redirect(url);
  }

  if (resolvedRequestedPath !== requestedPath) {
    return NextResponse.redirect(new URL(resolvedRequestedPath, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
