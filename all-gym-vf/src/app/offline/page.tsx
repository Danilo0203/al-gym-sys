import Link from "next/link";
import { IconWifiOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Sin conexión",
};

export default function OfflinePage() {
  return (
    <div className="bg-muted flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md border-border/70">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconWifiOff className="h-6 w-6" />
          </div>
          <CardTitle>Sin conexión</CardTitle>
          <CardDescription>
            No fue posible conectarse a internet. Si ya abriste tu espacio antes, vuelve a intentar desde la sección del cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild>
            <Link href="/mi/rutina">Abrir mi rutina</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/iniciar-sesion">Volver al inicio de sesión</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
