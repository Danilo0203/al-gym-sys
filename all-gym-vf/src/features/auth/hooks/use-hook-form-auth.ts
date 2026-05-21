"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { createBrowserClient } from "@supabase/ssr";
import { parseUserRole, resolvePostLoginRoute } from "@/lib/auth/role-utils";
import { isValidPasswordLoginIdentifier, resolvePasswordSignInCredentials } from "@/lib/auth/identifiers";

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
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      );

      const credentials = resolvePasswordSignInCredentials(data.identifier, data.password);
      if (!credentials) {
        form.setError("identifier", { message: "Introduce un correo o teléfono válido" });
        return;
      }

      const { error, data: authData } = await supabase.auth.signInWithPassword(credentials);

      if (error) {
        toast.error(error.message);
      } else {
        let roleSlug = typeof authData.user?.user_metadata?.role === "string" ? authData.user.user_metadata.role : null;
        let role = parseUserRole(roleSlug);
        let roleScope: string | null = null;

        if (authData.user) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", authData.user.id)
            .maybeSingle();

          if (profileError) {
            console.error("[legacy-login] profile lookup failed", profileError);
          } else if (typeof profile?.role === "string" && profile.role.trim().length > 0) {
            roleSlug = profile.role;
            role = parseUserRole(roleSlug) ?? role;
          }

          if (roleSlug) {
            const { data: roleData, error: roleError } = await supabase
              .from("roles")
              .select("scope")
              .eq("slug", roleSlug)
              .maybeSingle();

            if (roleError) {
              console.error("[legacy-login] role scope lookup failed", roleError);
            } else {
              roleScope = roleData?.scope ?? null;
            }
          }
        }

        toast.success(`¡Sesión iniciada correctamente!`);
        onSuccessRedirect(
          resolvePostLoginRoute({
            role,
            roleScope,
            requestedPath: callbackUrl,
          }),
        );
      }
    });
  };

  return {
    form,
    loading,
    onSubmit,
  };
}
