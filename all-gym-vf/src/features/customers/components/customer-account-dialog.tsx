"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { IconAlertTriangle, IconKey, IconLoader2, IconMail } from "@tabler/icons-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormInputGroup } from "@/components/forms/form-input-group";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdateCustomerAccount } from "@/features/customers/hooks/use-customers";
import type { CustomerDetail, UpdateCustomerAccountInput } from "@/features/customers/lib/local-customers";

const accountFormSchema = z
  .object({
    email: z.string().trim().refine(
      (value) => value === "" || z.email().safeParse(value).success,
      { message: "Correo electrónico inválido" },
    ),
    new_password: z.string().refine(
      (value) => value.length === 0 || (value.length >= 8 && value.length <= 128),
      { message: "La contraseña debe tener entre 8 y 128 caracteres" },
    ),
    confirm_new_password: z.string(),
  })
  .superRefine((value, context) => {
    if (value.new_password && !value.email) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "La contraseña requiere correo",
      });
    }

    if (value.new_password !== value.confirm_new_password) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirm_new_password"],
        message: "La confirmación no coincide",
      });
    }
  });

type AccountFormValues = z.infer<typeof accountFormSchema>;

interface CustomerAccountDialogProps {
  customer: CustomerDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerAccountDialog({
  customer,
  open,
  onOpenChange,
}: CustomerAccountDialogProps) {
  const accountMutation = useUpdateCustomerAccount();
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      email: customer.account.email ?? "",
      new_password: "",
      confirm_new_password: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      email: customer.account.email ?? "",
      new_password: "",
      confirm_new_password: "",
    });
  }, [customer.account.email, form, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (accountMutation.isPending) return;

    if (!nextOpen) {
      form.reset({
        email: customer.account.email ?? "",
        new_password: "",
        confirm_new_password: "",
      });
    }
    onOpenChange(nextOpen);
  };

  const onSubmit = async (values: AccountFormValues) => {
    const normalizedEmail = values.email.trim().toLowerCase();
    const currentEmail = customer.account.email?.toLowerCase() ?? null;
    const payload: UpdateCustomerAccountInput = {};

    if (!normalizedEmail && currentEmail) {
      form.setError("email", { message: "Correo electrónico inválido" });
      return;
    }

    if (normalizedEmail && normalizedEmail !== currentEmail) {
      payload.email = normalizedEmail;
    }
    if (values.new_password) {
      payload.new_password = values.new_password;
    }

    if (Object.keys(payload).length === 0) {
      toast.info("No hay cambios de cuenta para guardar.");
      return;
    }

    let updatedCustomer: CustomerDetail;
    try {
      updatedCustomer = await accountMutation.mutateAsync({
        id: customer.id,
        data: payload,
      });
    } catch {
      return;
    }

    form.reset({
      email: updatedCustomer.account.email ?? "",
      new_password: "",
      confirm_new_password: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar cuenta</DialogTitle>
          <DialogDescription>
            Administra el correo y las credenciales locales de {customer.full_name}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Cambiar el correo o la contraseña cerrará las sesiones activas del cliente.</p>
            </div>
          </div>

          <div className="space-y-4">
            <FormInputGroup
              control={form.control}
              name="email"
              label="Correo electrónico"
              placeholder="cliente@correo.com"
              type="email"
              autoComplete="email"
              icon={<IconMail className="h-4 w-4" />}
            />
            <FormInputGroup
              control={form.control}
              name="new_password"
              label={customer.account.has_password ? "Nueva contraseña" : "Primera contraseña"}
              description="Déjala vacía para conservar la contraseña actual. Debe tener entre 8 y 128 caracteres."
              type="password"
              autoComplete="new-password"
              icon={<IconKey className="h-4 w-4" />}
            />
            <FormInputGroup
              control={form.control}
              name="confirm_new_password"
              label="Confirmar nueva contraseña"
              type="password"
              autoComplete="new-password"
              icon={<IconKey className="h-4 w-4" />}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={accountMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={accountMutation.isPending}>
              {accountMutation.isPending ? <IconLoader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
