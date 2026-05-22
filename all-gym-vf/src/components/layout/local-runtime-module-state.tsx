import Link from "next/link";
import { AlertTriangle, Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LocalRuntimeModuleStateProps {
  moduleName: string;
  summary: string;
}

export function LocalRuntimeModuleState({ moduleName, summary }: LocalRuntimeModuleStateProps) {
  return (
    <Card className="border-amber-300/70 bg-amber-50/60 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-amber-500/40 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Runtime local
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            Migración gradual
          </Badge>
        </div>
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            {moduleName} todavía no está habilitado en la versión local
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm leading-6 text-amber-950/80 dark:text-amber-100/80">
            {summary}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/panel/resumen">Volver al tablero</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/panel">Ir al panel principal</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
