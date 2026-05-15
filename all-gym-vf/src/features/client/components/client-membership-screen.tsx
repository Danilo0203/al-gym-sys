"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  IconCalendarDue,
  IconCards,
  IconCreditCard,
  IconHistory,
  IconReceipt,
  IconSparkles,
} from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { ClientErrorState, ClientLoadingState } from "@/features/client/components/client-resource-state";
import { ClientSyncStatus } from "@/features/client/components/client-sync-status";
import { useClientMembership } from "@/features/client/hooks/use-client-api";

function formatDate(value: string | null | undefined) {
  if (!value) return "No disponible";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "d MMM yyyy", { locale: es });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    maximumFractionDigits: 2,
  }).format(value);
}

export function ClientMembershipScreen() {
  const membershipQuery = useClientMembership();

  if (membershipQuery.isPending) {
    return <ClientLoadingState title="Cargando el estado de tu membresía..." />;
  }

  if (membershipQuery.isError) {
    return (
      <ClientErrorState
        title="No fue posible cargar tu membresía"
        description="Intenta nuevamente cuando tengas conexión."
      />
    );
  }

  const { data, meta } = membershipQuery.data;
  const overview = data.overview;
  const latestSubscription = data.subscriptions[0] ?? null;

  return (
    <div className="space-y-6 pb-4">
      <div className="space-y-4">
        <ClientSyncStatus meta={meta} />
        <section className="relative overflow-hidden rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.14),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] shadow-sm">
          <div className="flex flex-col gap-6 p-5 md:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <IconSparkles className="h-3.5 w-3.5" />
                  Estado de tu acceso
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black tracking-tight md:text-4xl">Tu membresía</h2>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                    Consulta tu plan actual, la fecha de vencimiento y tu historial reciente.
                  </p>
                </div>
              </div>

              <SubscriptionStatusBadge
                status={overview?.subscription_status}
                endDate={overview?.subscription_end_date}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <ClientMembershipMetric
                icon={<IconCreditCard className="h-4 w-4" />}
                label="Plan activo"
                value={overview?.plan_name || "Sin plan asignado"}
                helper={
                  latestSubscription
                    ? `Último cargo ${formatCurrency(latestSubscription.price - latestSubscription.discount_amount)}`
                    : "Sin cargos recientes"
                }
              />
              <ClientMembershipMetric
                icon={<IconCalendarDue className="h-4 w-4" />}
                label="Vigencia"
                value={formatDate(overview?.subscription_end_date)}
                helper={`Inicio: ${formatDate(overview?.subscription_start_date)}`}
              />
              <ClientMembershipMetric
                icon={<IconCards className="h-4 w-4" />}
                label="Renovaciones"
                value={`${data.subscriptions.length}`}
                helper="Membresías registradas en tu cuenta"
              />
              <ClientMembershipMetric
                icon={<IconReceipt className="h-4 w-4" />}
                label="Último check-in"
                value={formatDate(overview?.last_check_in)}
                helper="Tu registro más reciente en el gimnasio"
              />
            </div>
          </div>
        </section>
      </div>

      <Card className="border-border/70 bg-card/70 shadow-sm">
        <CardHeader className="space-y-3 border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <IconHistory className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Historial de membresías</CardTitle>
              <CardDescription>Tus renovaciones y planes más recientes.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          {data.subscriptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
              Aún no hay membresías registradas en tu cuenta.
            </div>
          ) : (
            data.subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/35 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-semibold">{subscription.plan_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(subscription.start_date)} - {formatDate(subscription.end_date)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <SubscriptionStatusBadge status={subscription.status} endDate={subscription.end_date} />
                  <div className="text-right text-sm">
                    <p className="font-semibold">{formatCurrency(subscription.price - subscription.discount_amount)}</p>
                    {subscription.discount_amount > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Descuento: {formatCurrency(subscription.discount_amount)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClientMembershipMetric({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-background/45 p-4 shadow-sm backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold leading-tight text-foreground md:text-lg">{value}</p>
        {helper ? <p className="text-sm leading-relaxed text-muted-foreground">{helper}</p> : null}
      </div>
    </div>
  );
}
