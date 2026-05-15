'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { PASSWORD_RECOVERY_ENABLED } from "@/lib/auth/feature-flags";
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { IconLoader2, IconBarbell, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

export default function VerifyCodePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!PASSWORD_RECOVERY_ENABLED) {
    return (
      <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Link href="/" className="flex items-center gap-2 self-center font-semibold text-lg">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <IconBarbell className="size-5" />
            </div>
            All Gym
          </Link>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Recuperación deshabilitada</CardTitle>
              <CardDescription>
                La verificación por correo está deshabilitada mientras la app use una URL temporal.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button asChild className="w-full">
                <Link href="/iniciar-sesion">Volver al inicio de sesión</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!email) {
      toast.error('Correo electrónico no encontrado');
      router.push('/auth/forgot-password');
    }
  }, [email, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoading(true);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
      );

      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) {
        toast.error(error.message === 'Token has expired or is invalid' 
          ? 'El código es inválido o ha expirado' 
          : error.message
        );
      } else {
        toast.success('Código verificado correctamente');
        router.push('/auth/reset-password');
      }
    } catch {
      toast.error('Error al verificar el código');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-semibold text-lg">
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <IconBarbell className="size-5" />
          </div>
          All Gym
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Verificar código</CardTitle>
            <CardDescription>
              Ingresa el código de 8 dígitos enviado a {email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field className="flex flex-col items-center">
                  <FieldLabel htmlFor="token" className="sr-only">Código de verificación</FieldLabel>
                  <InputOTP
                    maxLength={8}
                    value={token}
                    onChange={(value) => setToken(value)}
                    disabled={isLoading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                      <InputOTPSlot index={6} />
                      <InputOTPSlot index={7} />
                    </InputOTPGroup>
                  </InputOTP>
                </Field>
                <Field>
                  <Button type="submit" disabled={isLoading || token.length < 8} className="w-full">
                    {isLoading && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verificar
                  </Button>
                </Field>
                <div className="text-center text-sm">
                  <Link href="/auth/forgot-password" className="flex items-center justify-center gap-2 text-muted-foreground hover:text-primary">
                    <IconArrowLeft className="size-4" />
                    Cambiar correo electrónico
                  </Link>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
