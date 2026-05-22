"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Panel route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100dvh-52px)] items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-destructive/30 bg-background p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-destructive/10 p-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-3">
            <div>
              <h1 className="text-xl font-semibold">Error al cargar este módulo</h1>
              <p className="text-sm text-muted-foreground">
                La aplicación interceptó la excepción para evitar una pantalla blanca. Puedes reintentar o volver al resumen.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={reset}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href="/panel/resumen">Ir al resumen</Link>
              </Button>
            </div>
            {error.digest ? (
              <p className="text-xs text-muted-foreground">Referencia: {error.digest}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
