"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { parseUserRole, resolvePostLoginRoute } from "@/lib/auth/role-utils";
import { isValidPasswordLoginIdentifier, resolvePasswordSignInCredentials } from "@/lib/auth/identifiers";
import { loginWithLocalAuth } from "@/lib/auth/client-auth";

const formSchema = z.object({
  identifier: z.string().refine((value) => isValidPasswordLoginIdentifier(value), {
    message: "Introduce un correo o teléfono válido",
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
      identifier: "",
      password: "",
    },
  });

  const onSubmit = async (data: UserAuthFormValue) => {
    startTransition(async () => {
      const credentials = resolvePasswordSignInCredentials(data.identifier, data.password);
      if (!credentials) {
        form.setError("identifier", { message: "Introduce un correo o teléfono válido" });
        return;
      }

      if (typeof credentials.email !== "string") {
        toast.error("El acceso con teléfono aún no está disponible en el backend local.");
        return;
      }

      try {
        const authContext = await loginWithLocalAuth({
          email: credentials.email,
          password: credentials.password,
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
