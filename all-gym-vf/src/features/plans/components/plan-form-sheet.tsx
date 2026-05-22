"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FormInput } from "@/components/forms/form-input";
import { FormTextarea } from "@/components/forms/form-textarea";
import { FormSwitch } from "@/components/forms/form-switch";
import { IconPlus, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Plan } from "../actions/plan-actions";
import { PlanFormValues, useHookFormPlans } from "../hooks/use-hook-form-plans";

interface PlanFormSheetProps {
  mode?: "create" | "edit";
  plan?: Plan | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PlanFormSheet({
  mode = "create",
  plan = null,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: PlanFormSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange || setInternalOpen : setInternalOpen;

  const { form, isPending, isEditing, onSubmit } = useHookFormPlans({
    open,
    mode,
    plan,
    onClose: () => setOpen(false),
  });
  const handlePlanSubmit: SubmitHandler<PlanFormValues> = (values) => onSubmit(values);

  const defaultTrigger = (
    <Button size="sm">
      <IconPlus className="mr-2 h-4 w-4" /> Nuevo Plan
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>
      ) : (
        <SheetTrigger asChild>{defaultTrigger}</SheetTrigger>
      )}
      <SheetContent className="sm:max-w-xl w-full flex flex-col h-full p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b space-y-1 sticky top-0 bg-background/80 backdrop-blur-md z-10">
          <SheetTitle>{isEditing ? "Editar Plan" : "Crear Nuevo Plan"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modifica los detalles del plan de membresía."
              : "Configura un nuevo plan de membresía para tus clientes."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form onSubmit={form.handleSubmit(handlePlanSubmit)} className="space-y-6 pb-4">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                Información Básica
              </h4>
              <div className="space-y-4 pl-4">
                <FormInput
                  control={form.control}
                  name="name"
                  label="Nombre del Plan"
                  placeholder="Ej. Mensual VIP"
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    control={form.control}
                    name="price"
                    label="Precio (Q)"
                    type="number"
                    placeholder="0.00"
                  />
                  <FormInput
                    control={form.control}
                    name="duration_days"
                    label="Duración (Días)"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="30"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                Detalles Adicionales
              </h4>
              <div className="space-y-4 pl-4">
                <FormTextarea
                  control={form.control}
                  name="description"
                  label="Descripción"
                  placeholder="Detalles opcionales del plan..."
                />

                <FormSwitch
                  control={form.control}
                  name="is_active"
                  label="Plan Activo"
                  description="Si está desactivado, no aparecerá para nuevos clientes."
                />
              </div>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-background/80 backdrop-blur-md z-10">
          <Button variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} onClick={form.handleSubmit(handlePlanSubmit)}>
            {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar Cambios" : "Crear Plan"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
