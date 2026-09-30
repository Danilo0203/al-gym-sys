"use client";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { FormInput } from "@/components/forms/form-input";
import { useHookFormAuth } from "../hooks/use-hook-form-auth";

export default function UserAuthForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl");
  const { form, loading, onSubmit } = useHookFormAuth({
    callbackUrl,
    onSuccessRedirect: (path) => router.push(path),
  });

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-2">
        <FormInput
          control={form.control}
          name="identifier"
          label="Correo o teléfono"
          placeholder="Introduce tu correo o teléfono..."
          disabled={loading}
        />
        <FormInput
          control={form.control}
          name="password"
          label="Contraseña"
          type="password"
          placeholder="Introduce tu contraseña..."
          disabled={loading}
        />
        <Button disabled={loading} className="mt-2 ml-auto w-full" type="submit">
          Iniciar sesión
        </Button>
      </form>
    </>
  );
}
