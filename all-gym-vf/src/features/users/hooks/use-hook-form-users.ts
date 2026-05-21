"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { createUser, updateUser, type UserData } from "../actions/user-actions";
import { emitAdminRefresh } from "@/lib/admin-refresh";

const userFormSchema = z.object({
  email: z.string().email({ message: "Correo electrónico inválido" }),
  full_name: z.string().min(2, { message: "El nombre es obligatorio" }),
  role: z.string().min(1, { message: "Selecciona un rol válido" }),
  password: z.string().optional(),
});

const createSchema = userFormSchema.extend({
  password: z.string().min(6, { message: "Mínimo 6 caracteres" }),
});

const editSchema = userFormSchema;

export type UserFormValues = z.infer<typeof userFormSchema>;

interface UseHookFormUsersParams {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData | null;
}

export function useHookFormUsers({ open, onOpenChange, user }: UseHookFormUsersParams) {
  const [isPending, startTransition] = useTransition();
  const isEditing = !!user;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(isEditing ? editSchema : createSchema),
    defaultValues: {
      email: "",
      full_name: "",
      role: "employee",
      password: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        email: user?.email || "",
        full_name: user?.full_name || "",
        role: user?.role || "employee",
        password: "",
      });
    }
  }, [open, user, form]);

  const onSubmit = (values: UserFormValues) => {
    startTransition(async () => {
      try {
        if (isEditing && user) {
          const result = await updateUser({
            id: user.id,
            full_name: values.full_name,
            role: values.role,
            password: values.password || undefined,
          });

          if (result.success) {
            toast.success("Usuario actualizado correctamente");
            onOpenChange(false);
            emitAdminRefresh("users");
          } else {
            toast.error(result.error || "Error al actualizar usuario");
          }
          return;
        }

        if (!values.password) {
          form.setError("password", { message: "La contraseña es obligatoria" });
          return;
        }

        const result = await createUser({
          email: values.email,
          full_name: values.full_name,
          role: values.role,
          password: values.password,
        });

        if (result.success) {
          toast.success("Usuario creado correctamente");
          onOpenChange(false);
          emitAdminRefresh("users");
        } else {
          toast.error(result.error || "Error al crear usuario");
        }
      } catch {
        toast.error("Error inesperado");
      }
    });
  };

  return {
    form,
    isPending,
    isEditing,
    onSubmit,
  };
}
