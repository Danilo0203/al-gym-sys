'use client';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconBarbell } from '@tabler/icons-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
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
            <CardTitle className="text-xl">Cambio de contraseña deshabilitado</CardTitle>
            <CardDescription>
              Esta ruta dependía de Supabase Auth y quedó deshabilitada mientras la autenticación use el backend local.
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
