import { getLocalAuthMeFromRequest, isLocalAuthEnabled } from "@/lib/auth/local-auth-server";
import { createServerClient } from "@supabase/ssr";
import { parseUserRole, resolvePostLoginRoute } from "@/lib/auth/role-utils";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtectedArea = pathname.startsWith("/panel") || pathname.startsWith("/mi");
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (isLocalAuthEnabled()) {
    const session = await getLocalAuthMeFromRequest(request);
    const user = session?.user ?? null;

    if (!user && isProtectedArea) {
      const url = request.nextUrl.clone();
      url.pathname = "/iniciar-sesion";
      return NextResponse.redirect(url);
    }

    if (!user) {
      return response;
    }

    const role = parseUserRole(user.role);
    const roleScope = user.roleScope ?? null;
    const defaultRoute = resolvePostLoginRoute({
      role,
      roleScope,
    });
    const requestedPath = `${pathname}${request.nextUrl.search}`;
    const resolvedRequestedPath = resolvePostLoginRoute({
      role,
      roleScope,
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (request.nextUrl.pathname.startsWith("/panel")) {
      console.warn("Supabase environment variables are missing! Authentication will not work.");
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedArea) {
    const url = request.nextUrl.clone();
    url.pathname = "/iniciar-sesion";
    return NextResponse.redirect(url);
  }

  if (!user) {
    return response;
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const roleSlug = (profile?.role || user.user_metadata?.role || null) as string | null;
  const role = parseUserRole(roleSlug);

  // Fetch role scope from DB
  let scope: string | null = null;
  if (roleSlug) {
    const { data: roleData } = await supabase
      .from("roles")
      .select("scope")
      .eq("slug", roleSlug)
      .maybeSingle();
    scope = roleData?.scope || null;
  }

  const defaultRoute = resolvePostLoginRoute({
    role,
    roleScope: scope,
  });
  const requestedPath = `${pathname}${request.nextUrl.search}`;
  const resolvedRequestedPath = resolvePostLoginRoute({
    role,
    roleScope: scope,
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
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
