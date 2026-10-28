"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { parseUserRole, resolvePostLoginRoute } from "@/lib/auth/role-utils";
import { resolvePasswordSignInCredentials } from "@/lib/auth/identifiers";
import { activatePhoneAccess, getPhoneAccess, LocalAuthProxyError, loginWithLocalAuth } from "@/lib/auth/client-auth";
import { toast } from "sonner";
import { IconLoader2 } from "@tabler/icons-react";

type LoginStep = "identifier" | "password" | "first-access";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [step, setStep] = useState<LoginStep>("identifier");
  const [isLoading, setIsLoading] = useState(false);
  const firstAccess = step === "first-access";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      const credentials = resolvePasswordSignInCredentials(identifier, password);
      if (!credentials) { toast.error("Ingresa un correo o teléfono válido"); return; }
      if (step === "identifier") {
        if (credentials.phone) {
          const access = await getPhoneAccess(credentials.phone);
          setStep(access.requiresPasswordSetup ? "first-access" : "password");
        } else { setStep("password"); }
        return;
      }
      if (firstAccess && password !== confirmation) {
        toast.error("Las contraseñas no coinciden"); return;
      }
      const context = firstAccess && credentials.phone
        ? await activatePhoneAccess(credentials.phone, password)
        : await loginWithLocalAuth(credentials);
      toast.success(`¡Bienvenido ${context.user.profile.fullName.trim() || "usuario"}!`);
      window.location.assign(resolvePostLoginRoute({
        role: parseUserRole(context.authorization.roleSlug), roleScope: context.authorization.scope,
        permissions: context.authorization.permissions, isOwner: context.authorization.isOwner,
      }));
    } catch (error) {
      if (error instanceof LocalAuthProxyError && error.code === "FIRST_ACCESS_COMPLETED") {
        setStep("password"); setPassword(""); setConfirmation("");
      }
      toast.error(error instanceof LocalAuthProxyError && error.code === "INVALID_CREDENTIALS"
        ? "Teléfono, correo o contraseña incorrectos"
        : error instanceof Error ? error.message : "No se pudo iniciar sesión");
    } finally { setIsLoading(false); }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{firstAccess ? "Crea tu contraseña" : "Bienvenido"}</CardTitle>
          <CardDescription>{firstAccess
            ? "Es tu primer ingreso. Elige la contraseña que usarás para entrar a AlGym."
            : "Accede con tu teléfono o correo registrado en el gimnasio."}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="identifier">Teléfono o correo</FieldLabel>
                <Input id="identifier" type="text" autoComplete="username" autoCapitalize="none"
                  spellCheck={false} placeholder="Tu número de 8 dígitos o correo" required maxLength={320}
                  value={identifier} onChange={(event) => setIdentifier(event.target.value)}
                  disabled={isLoading} readOnly={step !== "identifier"} />
              </Field>
              {step !== "identifier" && <>
                <Field>
                  <FieldLabel htmlFor="password">{firstAccess ? "Nueva contraseña" : "Contraseña"}</FieldLabel>
                  <Input key={step} id="password" type="password" required
                    autoComplete={firstAccess ? "new-password" : "current-password"}
                    minLength={firstAccess ? 8 : 1} maxLength={firstAccess ? 128 : 256}
                    value={password} onChange={(event) => setPassword(event.target.value)} disabled={isLoading} />
                  {firstAccess && <p className="text-xs text-muted-foreground">Usa al menos 8 caracteres.</p>}
                </Field>
                {firstAccess && <Field>
                  <FieldLabel htmlFor="confirmation">Confirma tu contraseña</FieldLabel>
                  <Input id="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
                    value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={isLoading} />
                </Field>}
              </>}
              <Field>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {step === "identifier" ? "Continuar" : firstAccess ? "Crear contraseña y entrar" : "Iniciar sesión"}
                </Button>
                {step !== "identifier" && <Button type="button" variant="ghost" disabled={isLoading} onClick={() => {
                  setStep("identifier"); setPassword(""); setConfirmation("");
                }}>Usar otro teléfono o correo</Button>}
              </Field>
              <p className="text-center text-xs text-muted-foreground">
                {firstAccess ? "Después de crearla, solo el administrador podrá cambiar tu contraseña." : "Si olvidaste tu contraseña, solicita el cambio en recepción."}
              </p>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
