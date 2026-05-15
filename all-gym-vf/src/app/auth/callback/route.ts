import { createClient } from "@/lib/supabase/server";
import { OAUTH_LOGIN_ENABLED } from "@/lib/auth/feature-flags";
import { parseUserRole, resolvePostLoginRoute } from "@/lib/auth/role-utils";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!OAUTH_LOGIN_ENABLED) {
    return NextResponse.redirect(`${origin}/iniciar-sesion?error=oauth_disabled`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let roleSlug = typeof user?.user_metadata?.role === "string" ? user.user_metadata.role : null;
      let role = parseUserRole(roleSlug);
      let roleScope: string | null = null;

      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

        if (typeof profile?.role === "string" && profile.role.trim().length > 0) {
          roleSlug = profile.role;
          role = parseUserRole(roleSlug) ?? role;
        }

        if (roleSlug) {
          const { data: roleData } = await supabase.from("roles").select("scope").eq("slug", roleSlug).maybeSingle();
          roleScope = roleData?.scope ?? null;
        }
      }

      return NextResponse.redirect(
        `${origin}${resolvePostLoginRoute({
          role,
          roleScope,
          requestedPath: next,
        })}`,
      );
    }
  }

  // Return to login page with error
  return NextResponse.redirect(`${origin}/iniciar-sesion?error=auth_failed`);
}
