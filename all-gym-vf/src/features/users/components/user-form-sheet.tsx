"use client";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { type UserData, getAvailableRoles, type RoleOption } from "../actions/user-actions";
import { useHookFormUsers } from "../hooks/use-hook-form-users";

interface UserFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData | null;
}

export function UserFormSheet({ open, onOpenChange, user }: UserFormSheetProps) {
  const { form, isPending, isEditing, onSubmit } = useHookFormUsers({ open, onOpenChange, user });
  const [roleOptions, setRoleOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    if (open) {
      getAvailableRoles().then((result) => {
        if (result.success && result.data) {
          setRoleOptions(
            result.data.map((r: RoleOption) => ({
              label: r.name,
              value: r.slug,
            }))
          );
        }
      });
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full flex flex-col h-full p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b space-y-1 sticky top-0 bg-background/80 backdrop-blur-md z-10">
          <SheetTitle>{isEditing ? "Editar usuario" : "Nuevo usuario"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modifica los datos del usuario. Deja la contraseña en blanco para mantener la actual."
              : "Crea un nuevo usuario interno para el sistema. Los clientes se registran desde Clientes."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-4">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                Información personal
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4">
                <FormInput control={form.control} name="full_name" label="Nombre Completo" placeholder="Juan Pérez" />
                <FormInput
                  control={form.control}
                  name="email"
                  label="Correo electrónico"
                  type="email"
                  placeholder="juan@gym.com"
                  disabled={isEditing}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                Seguridad y acceso
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4">
                <FormSelect
                  control={form.control}
                  name="role"
                  label="Rol"
                  options={roleOptions.length > 0 ? roleOptions : [
                    { label: "Propietario", value: "owner" },
                    { label: "Administrador", value: "admin" },
                    { label: "Entrenador", value: "trainer" },
                    { label: "Empleado", value: "employee" },
                  ]}
                />
                <FormInput
                  control={form.control}
                  name="password"
                  label={isEditing ? "Nueva contraseña" : "Contraseña"}
                  type="password"
                  placeholder={isEditing ? "(Sin cambios)" : "Mínimo 6 caracteres"}
                />
              </div>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-background/80 backdrop-blur-md z-10">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} onClick={form.handleSubmit(onSubmit)}>
            {isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
