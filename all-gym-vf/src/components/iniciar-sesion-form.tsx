"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PASSWORD_RECOVERY_ENABLED, OAUTH_LOGIN_ENABLED } from "@/lib/auth/feature-flags";
import { parseUserRole, resolvePostLoginRoute } from "@/lib/auth/role-utils";
import { resolvePasswordSignInCredentials } from "@/lib/auth/identifiers";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import { IconLoader2 } from "@tabler/icons-react";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      );

      const credentials = resolvePasswordSignInCredentials(identifier, password);
      if (!credentials) {
        toast.error("Ingresa un correo o teléfono válido");
        return;
      }

      const { error, data } = await supabase.auth.signInWithPassword(credentials);

      if (error) {
        toast.error(error.message === "Invalid login credentials" ? "Credenciales incorrectas" : error.message);
      } else if (data.user) {
        const displayName =
          typeof data.user.user_metadata?.full_name === "string" && data.user.user_metadata.full_name.trim().length > 0
            ? data.user.user_metadata.full_name.trim()
            : "usuario";

        let roleSlug = typeof data.user.user_metadata?.role === "string" ? data.user.user_metadata.role : null;
        let role = parseUserRole(roleSlug);
        let roleScope: string | null = null;

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw sessionError;
        }

        if (!sessionData.session) {
          throw new Error("No fue posible guardar la sesión del usuario.");
        }

        try {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role, full_name")
            .eq("id", data.user.id)
            .maybeSingle();

          if (profileError) {
            console.error("[login] profile lookup failed", profileError);
          } else {
            if (typeof profile?.role === "string" && profile.role.trim().length > 0) {
              roleSlug = profile.role;
            }
            role = parseUserRole(roleSlug) ?? role;

            if (roleSlug) {
              const { data: roleData, error: roleError } = await supabase
                .from("roles")
                .select("scope")
                .eq("slug", roleSlug)
                .maybeSingle();

              if (roleError) {
                console.error("[login] role scope lookup failed", roleError);
              } else {
                roleScope = roleData?.scope ?? null;
              }
            }
          }

          toast.success(`¡Bienvenido de nuevo ${profile?.full_name || displayName}!`);
        } catch (profileLookupError) {
          console.error("[login] unexpected profile lookup error", profileLookupError);
          toast.success(`¡Bienvenido de nuevo ${displayName}!`);
        }

        window.location.assign(
          resolvePostLoginRoute({
            role,
            roleScope,
          }),
        );
      }
    } catch (error) {
      console.error("[login] sign-in failure", error);
      toast.error(error instanceof Error ? error.message : "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!OAUTH_LOGIN_ENABLED) {
      toast.error("El acceso con Google está deshabilitado en este despliegue.");
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      );

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error("Error con Google: " + error.message);
        setIsLoading(false);
      }
    } catch {
      toast.error("Error al iniciar sesión con Google");
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Bienvenido</CardTitle>
          <CardDescription>Ingresa tus credenciales para acceder al sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {OAUTH_LOGIN_ENABLED ? (
                <>
                  <Field>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      className="w-full"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
                        <path
                          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                          fill="currentColor"
                        />
                      </svg>
                      Continuar con Google
                    </Button>
                  </Field>
                  <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                    O continúa con tus credenciales
                  </FieldSeparator>
                </>
              ) : null}
              <Field>
                <FieldLabel htmlFor="identifier">Correo o teléfono</FieldLabel>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="tu@email.com o 12345678"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={isLoading}
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                  {PASSWORD_RECOVERY_ENABLED ? (
                    <a
                      href="/auth/forgot-password"
                      className="ml-auto text-sm underline-offset-4 hover:underline text-muted-foreground"
                    >
                      ¿Olvidaste tu contraseña?
                    </a>
                  ) : null}
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </Field>
              <Field>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Iniciar sesión
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
