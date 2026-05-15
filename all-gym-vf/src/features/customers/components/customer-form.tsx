"use client";

import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormTextarea } from "@/components/forms/form-textarea";
import { FormDatePicker } from "@/components/forms/form-date-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileFormData, useHookFormCustomerProfile } from "../hooks/use-hook-form-customers";

export default function CustomerForm({
  initialData,
  pageTitle,
}: {
  initialData: ProfileFormData | null;
  pageTitle: string;
}) {
  const { form, onSubmit, onCancel } = useHookFormCustomerProfile({ initialData });

  return (
    <Card className="mx-auto w-full">
      <CardHeader>
        <CardTitle className="text-left text-2xl font-bold">{pageTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormInput
            control={form.control}
            name="full_name"
            label="Nombre Completo"
            placeholder="Ej: Juan Pérez"
            required
          />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormInput control={form.control} name="phone" label="Teléfono" placeholder="Ej: 555-1234" />
            <FormDatePicker control={form.control} name="birth_date" label="Fecha de Nacimiento" />
          </div>

          <FormSelect
            control={form.control}
            name="gender"
            label="Género"
            placeholder="Seleccionar género"
            options={[
              { label: "Masculino", value: "male" },
              { label: "Femenino", value: "female" },
              { label: "Otro", value: "other" },
            ]}
          />

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-4">Contacto de Emergencia</h4>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormInput
                control={form.control}
                name="emergency_contact"
                label="Nombre del Contacto"
                placeholder="Nombre del contacto"
              />
              <FormInput
                control={form.control}
                name="emergency_phone"
                label="Teléfono del Contacto"
                placeholder="Teléfono del contacto"
              />
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-4">Información Médica</h4>
            <div className="space-y-4">
              <FormTextarea
                control={form.control}
                name="injuries"
                label="Lesiones"
                placeholder="Describe lesiones previas o actuales..."
                config={{ rows: 3 }}
              />
              <FormTextarea
                control={form.control}
                name="medical_notes"
                label="Notas Médicas"
                placeholder="Alergias, condiciones médicas, etc..."
                config={{ rows: 3 }}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit">Guardar Cliente</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
