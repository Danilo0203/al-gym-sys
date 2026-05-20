"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { loginWithLocalAuth } from "@/lib/auth/local-auth-client";
import { parseUserRole, resolvePostLoginRoute } from "@/lib/auth/role-utils";

const formSchema = z.object({
  email: z.string().email({ message: "Introduce un correo electrónico válido" }),
  password: z.string().min(1, { message: "La contraseña es obligatoria" }),
});

export type UserAuthFormValue = z.infer<typeof formSchema>;

interface UseHookFormAuthParams {
  callbackUrl: string | null;
  onSuccessRedirect: (path: string) => void;
}

export function useHookFormAuth({ callbackUrl, onSuccessRedirect }: UseHookFormAuthParams) {
  const [loading, startTransition] = useTransition();
  const form = useForm<UserAuthFormValue>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "demo@gmail.com",
      password: "",
    },
  });

  const onSubmit = async (data: UserAuthFormValue) => {
    startTransition(async () => {
      try {
        const authData = await loginWithLocalAuth({
          email: data.email,
          password: data.password,
        });

        const role = parseUserRole(authData.user.role);
        const roleScope = authData.user.roleScope ?? null;

        toast.success(`¡Sesión iniciada correctamente!`);
        onSuccessRedirect(
          resolvePostLoginRoute({
            role,
            roleScope,
            requestedPath: callbackUrl || authData.redirectTo,
          }),
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al iniciar sesión");
      }
    });
  };

  return {
    form,
    loading,
    onSubmit,
  };
}
