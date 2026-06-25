"use client";

import { endOfDay } from "date-fns";
import { FormProvider } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormDatePicker } from "@/components/forms/form-date-picker";
import { ProfileData } from "../actions/profile-actions";
import { IconLoader2, IconDeviceFloppy } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHookFormProfile } from "../hooks/use-hook-form-profile";

interface ProfileFormProps {
  profile: ProfileData;
  canEditProfile: boolean;
}

export function ProfileForm({ profile, canEditProfile }: ProfileFormProps) {
  const { form, isPending, onSubmit } = useHookFormProfile(profile);

  return (
    <Card className="py-4 gap-4">
      <CardHeader className="px-4 py-0">
        <CardTitle>Información Personal</CardTitle>
        <CardDescription>
          {canEditProfile
            ? "Actualiza tu información personal."
            : "Puedes ver tu información personal, pero no tienes permiso para editarla."}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                control={form.control}
                name="full_name"
                label="Nombre Completo"
                placeholder="Tu nombre completo"
                disabled={!canEditProfile}
              />
              <FormInput
                control={form.control}
                name="phone"
                label="Teléfono"
                placeholder="+502 1234-5678"
                type="tel"
                disabled={!canEditProfile}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormDatePicker
                control={form.control}
                name="birth_date"
                label="Fecha de Nacimiento"
                required
                config={{
                  placeholder: "Selecciona una fecha",
                  maxDate: endOfDay(new Date()),
                }}
                disabled={!canEditProfile}
              />
              <FormSelect
                control={form.control}
                name="gender"
                label="Género"
                placeholder="Selecciona género"
                required
                disabled={!canEditProfile}
                options={[
                  { label: "Masculino", value: "male" },
                  { label: "Femenino", value: "female" },
                  { label: "Otro", value: "other" },
                ]}
              />
            </div>

            {canEditProfile ? (
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <IconDeviceFloppy className="mr-2 h-4 w-4" />
                  )}
                  Guardar Cambios
                </Button>
              </div>
            ) : null}
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
