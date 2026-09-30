"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { parseUserRole, resolvePostLoginRoute } from "@/lib/auth/role-utils";
import { resolvePasswordSignInCredentials } from "@/lib/auth/identifiers";
import { LocalAuthProxyError, loginWithLocalAuth } from "@/lib/auth/client-auth";
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
      const credentials = resolvePasswordSignInCredentials(identifier, password);
      if (!credentials) {
        toast.error("Ingresa un correo o teléfono válido");
        return;
      }

      if (typeof credentials.email !== "string") {
        toast.error("El acceso con teléfono aún no está disponible en el backend local.");
        return;
      }

      const authContext = await loginWithLocalAuth({
        email: credentials.email,
        password: credentials.password,
      });
      const displayName = authContext.user.profile.fullName.trim() || "usuario";

      toast.success(`¡Bienvenido de nuevo ${displayName}!`);
      window.location.assign(
        resolvePostLoginRoute({
          role: parseUserRole(authContext.authorization.roleSlug),
          roleScope: authContext.authorization.scope,
          permissions: authContext.authorization.permissions,
          isOwner: authContext.authorization.isOwner,
        }),
      );
    } catch (error) {
      console.error("[login] sign-in failure", error);
      toast.error(
        error instanceof LocalAuthProxyError && error.code === "INVALID_CREDENTIALS"
          ? "Credenciales incorrectas"
          : error instanceof Error
            ? error.message
            : "Error al iniciar sesión",
      );
    } finally {
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
              <Field>
                <FieldLabel htmlFor="identifier">Correo</FieldLabel>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="tu@email.com"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={isLoading}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
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
