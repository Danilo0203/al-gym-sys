"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { loginWithLocalAuth } from "@/lib/auth/client-auth";
import { parseUserRole, resolvePostLoginRoute } from "@/lib/auth/role-utils";

const formSchema = z.object({
  email: z.string().trim().toLowerCase().email({
    message: "Introduce un correo válido",
  }),
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
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: UserAuthFormValue) => {
    startTransition(async () => {
      try {
        const authContext = await loginWithLocalAuth({
          email: data.email,
          password: data.password,
        });

        toast.success(`¡Sesión iniciada correctamente!`);
        onSuccessRedirect(
          resolvePostLoginRoute({
            role: parseUserRole(authContext.authorization.roleSlug),
            roleScope: authContext.authorization.scope,
            permissions: authContext.authorization.permissions,
            isOwner: authContext.authorization.isOwner,
            requestedPath: callbackUrl,
          }),
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No fue posible iniciar sesión.");
      }
    });
  };

  return {
    form,
    loading,
    onSubmit,
  };
}
