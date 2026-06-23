"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PasswordForm() {
  return (
    <Card className="py-4 gap-4">
      <CardHeader className="px-4 py-0">
        <CardTitle>Cambiar Contraseña</CardTitle>
        <CardDescription>
          Esta función quedó deshabilitada mientras la autenticación use el backend local.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <Button variant="outline" className="w-full" disabled>
          Cambio de contraseña no disponible
        </Button>
      </CardContent>
    </Card>
  );
}
