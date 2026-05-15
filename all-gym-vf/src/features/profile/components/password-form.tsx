"use client";

import { FormProvider } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/forms/form-input";
import { IconLoader2, IconLock } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHookFormPassword } from "../hooks/use-hook-form-profile";

export function PasswordForm() {
  const { form, isPending, onSubmit } = useHookFormPassword();

  return (
    <Card className="py-4 gap-4">
      <CardHeader className="px-4 py-0">
        <CardTitle>Cambiar Contraseña</CardTitle>
        <CardDescription>Actualiza tu contraseña para mantener tu cuenta segura.</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormInput
              control={form.control}
              name="currentPassword"
              label="Contraseña Actual"
              type="password"
              placeholder="••••••••"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                control={form.control}
                name="newPassword"
                label="Nueva Contraseña"
                type="password"
                placeholder="••••••••"
              />
              <FormInput
                control={form.control}
                name="confirmPassword"
                label="Confirmar Contraseña"
                type="password"
                placeholder="••••••••"
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isPending} variant="outline">
                {isPending ? (
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <IconLock className="mr-2 h-4 w-4" />
                )}
                Cambiar Contraseña
              </Button>
            </div>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
