import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CashModuleSetupStateProps = {
  title?: string;
  description?: string;
};

export function CashModuleSetupState({
  title = "Módulo de caja pendiente de inicialización",
  description = "La base local todavía no tiene las tablas y funciones de Caja. Aplica las migraciones del backend local y vuelve a cargar esta pantalla.",
}: CashModuleSetupStateProps) {
  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Caja quedará en espera hasta que la base local esté preparada. Verifica las migraciones y el estado del backend antes de registrar cobros.
      </CardContent>
    </Card>
  );
}
