import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CashModuleSetupStateProps = {
  title?: string;
  description?: string;
};

export function CashModuleSetupState({
  title = "Modulo de caja pendiente de inicializacion",
  description = "La base activa todavia no tiene las tablas y funciones cash_*. Aplica la migracion supabase/migrations/20260330_cash_module_v1.sql y vuelve a cargar esta pantalla.",
}: CashModuleSetupStateProps) {
  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Mientras la migracion no este aplicada, el sistema seguira usando el flujo anterior de pagos y la seccion de caja
        quedara en modo de espera.
      </CardContent>
    </Card>
  );
}
