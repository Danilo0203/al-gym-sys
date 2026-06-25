"use client";

import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { IconEye, IconEyeOff, IconLoader2, IconLock, IconDeviceFloppy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useHookFormPassword } from "../hooks/use-hook-form-profile";

export function PasswordForm() {
  const { form, isPending, onSubmit } = useHookFormPassword();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <Card className="py-4 gap-4">
      <CardHeader className="px-4 py-0">
        <CardTitle>Cambiar Contraseña</CardTitle>
        <CardDescription>
          Actualiza tu contraseña. Al guardar, se cerrarán todas tus sesiones activas.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field data-invalid={!!form.formState.errors.currentPassword}>
              <FieldLabel htmlFor="currentPassword">Contraseña actual</FieldLabel>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  autoComplete="current-password"
                  aria-invalid={!!form.formState.errors.currentPassword}
                  className="pr-10"
                  disabled={isPending}
                  {...form.register("currentPassword")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7"
                  onClick={() => setShowCurrentPassword((value) => !value)}
                  disabled={isPending}
                  aria-label={showCurrentPassword ? "Ocultar contraseña actual" : "Mostrar contraseña actual"}
                >
                  {showCurrentPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                </Button>
              </div>
              <FieldError errors={[form.formState.errors.currentPassword]} />
            </Field>

            <Field data-invalid={!!form.formState.errors.newPassword}>
              <FieldLabel htmlFor="newPassword">Nueva contraseña</FieldLabel>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  aria-invalid={!!form.formState.errors.newPassword}
                  className="pr-10"
                  disabled={isPending}
                  {...form.register("newPassword")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7"
                  onClick={() => setShowNewPassword((value) => !value)}
                  disabled={isPending}
                  aria-label={showNewPassword ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
                >
                  {showNewPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                </Button>
              </div>
              <FieldError errors={[form.formState.errors.newPassword]} />
            </Field>

            <Field data-invalid={!!form.formState.errors.confirmPassword}>
              <FieldLabel htmlFor="confirmPassword">Confirmar nueva contraseña</FieldLabel>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  aria-invalid={!!form.formState.errors.confirmPassword}
                  className="pr-10"
                  disabled={isPending}
                  {...form.register("confirmPassword")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  disabled={isPending}
                  aria-label={showConfirmPassword ? "Ocultar confirmación de contraseña" : "Mostrar confirmación de contraseña"}
                >
                  {showConfirmPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                </Button>
              </div>
              <FieldError errors={[form.formState.errors.confirmPassword]} />
            </Field>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <IconDeviceFloppy className="mr-2 h-4 w-4" />
              )}
              Guardar nueva contraseña
            </Button>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <IconLock className="h-3.5 w-3.5" />
              Al confirmar, tu sesión actual y las demás sesiones activas serán revocadas.
            </p>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
