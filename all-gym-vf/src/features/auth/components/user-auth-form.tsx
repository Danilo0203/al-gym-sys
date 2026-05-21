"use client";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import GithubSignInButton from "./github-auth-button";
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
          placeholder="Introduce tu correo o 12345678..."
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
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">O continuar con</span>
        </div>
      </div>
      <GithubSignInButton />
    </>
  );
}
