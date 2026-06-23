import { fetchAuthBackend } from "@/lib/auth/backend-auth";
import { getAuthErrorMessage, parseAuthContext, parseJsonText } from "@/lib/auth/contracts";
import { parseUserRole, resolvePostLoginRoute } from "@/lib/auth/role-utils";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const isProtectedArea = pathname.startsWith("/panel") || pathname.startsWith("/mi");

  let authResponse: Response;

  try {
    authResponse = await fetchAuthBackend("/auth/me", {
      headers: request.headers.get("cookie") ? { cookie: request.headers.get("cookie") as string } : undefined,
    });
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : "No fue posible contactar el backend de autenticación local.",
      { status: 503 },
    );
  }

  if (authResponse.status === 401) {
    if (!isProtectedArea) {
      return response;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/iniciar-sesion";
    return NextResponse.redirect(url);
  }

  const authResponseText = await authResponse.text();

  if (!authResponse.ok) {
    const payload = authResponseText.trim() ? parseJsonText(authResponseText, "Local auth backend") : null;
    const errorMessage = payload ? getAuthErrorMessage(payload) : null;

    return new NextResponse(errorMessage ?? "No fue posible validar la sesión local.", {
      status: authResponse.status,
    });
  }

  const authContext = parseAuthContext(parseJsonText(authResponseText, "Local auth backend"), "Local auth backend");
  const roleSlug = authContext.authorization.roleSlug;
  const role = parseUserRole(roleSlug);
  const scope = authContext.authorization.scope;
  const permissions = authContext.authorization.permissions;
  const isOwner = authContext.authorization.isOwner;

  const defaultRoute = resolvePostLoginRoute({
    role,
    roleScope: scope,
    permissions,
    isOwner,
  });
  const requestedPath = `${pathname}${request.nextUrl.search}`;
  const resolvedRequestedPath = resolvePostLoginRoute({
    role,
    roleScope: scope,
    permissions,
    isOwner,
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
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
