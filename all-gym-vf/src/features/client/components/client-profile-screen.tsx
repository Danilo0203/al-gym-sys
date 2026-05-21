"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  IconCalendar,
  IconCreditCard,
  IconMail,
  IconPhone,
  IconSparkles,
  IconUser,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { ClientErrorState, ClientLoadingState } from "@/features/client/components/client-resource-state";
import { ClientSyncStatus } from "@/features/client/components/client-sync-status";
import { useClientProfile } from "@/features/client/hooks/use-client-api";

function formatDate(value: string | null | undefined) {
  if (!value) return "No disponible";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "d MMM yyyy", { locale: es });
}

function getInitials(name: string | null | undefined) {
  if (!name) return "AG";
  return name
    .split(" ")
    .map((chunk) => chunk[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ClientProfileScreen() {
  const profileQuery = useClientProfile();

  if (profileQuery.isPending) {
    return <ClientLoadingState title="Cargando tu perfil..." />;
  }

  if (profileQuery.isError) {
    return (
      <ClientErrorState
        title="No fue posible cargar tu perfil"
        description="Intenta nuevamente cuando tengas conexión."
      />
    );
  }

  const { data, meta } = profileQuery.data;
  const overview = data.overview;

  return (
    <div className="space-y-6 pb-4">
      <div className="space-y-4">
        <ClientSyncStatus meta={meta} />

        <section className="relative overflow-hidden rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] shadow-sm">
          <div className="flex flex-col gap-6 p-5 md:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar className="h-22 w-22 border-4 border-background shadow-sm ring-1 ring-border/70">
                  <AvatarImage src={data.avatar_url || ""} alt={data.full_name || "Cliente"} />
                  <AvatarFallback className="bg-primary text-xl font-black text-primary-foreground">
                    {getInitials(data.full_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <IconSparkles className="h-3.5 w-3.5" />
                    Resumen de tu cuenta
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-3xl font-black tracking-tight md:text-4xl">{data.full_name || "Cliente"}</h2>
                      <Badge variant="secondary">Cliente</Badge>
                    </div>
                    <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                      Mantén a mano tu información principal, tu plan actual y el estado general de tu cuenta.
                    </p>
                  </div>
                </div>
              </div>

              {overview?.subscription_status ? (
                <SubscriptionStatusBadge status={overview.subscription_status} endDate={overview.subscription_end_date} />
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <ProfileMetricCard
                icon={<IconMail className="h-4 w-4" />}
                label="Correo"
                value={data.email || "Sin correo"}
                helper="Credencial principal de tu cuenta"
              />
              <ProfileMetricCard
                icon={<IconPhone className="h-4 w-4" />}
                label="Teléfono"
                value={data.phone || "No registrado"}
                helper="Dato de contacto actual"
              />
              <ProfileMetricCard
                icon={<IconCreditCard className="h-4 w-4" />}
                label="Plan"
                value={overview?.plan_name || "Sin plan asignado"}
                helper={overview?.subscription_end_date ? `Vence ${formatDate(overview.subscription_end_date)}` : "Sin vigencia activa"}
              />
              <ProfileMetricCard
                icon={<IconCalendar className="h-4 w-4" />}
                label="Miembro desde"
                value={formatDate(data.created_at)}
                helper="Fecha de creación de tu cuenta"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="border-border/70 bg-card/70 shadow-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-lg font-semibold tracking-tight">Datos personales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <ProfileDetailRow icon={<IconUser className="mt-0.5 h-4 w-4 text-muted-foreground" />} label="Nombre completo" value={data.full_name || "No disponible"} />
            <ProfileDetailRow icon={<IconPhone className="mt-0.5 h-4 w-4 text-muted-foreground" />} label="Teléfono" value={data.phone || "No registrado"} />
            <ProfileDetailRow icon={<IconUser className="mt-0.5 h-4 w-4 text-muted-foreground" />} label="Género" value={data.gender || "No especificado"} />
            <ProfileDetailRow icon={<IconCalendar className="mt-0.5 h-4 w-4 text-muted-foreground" />} label="Fecha de nacimiento" value={formatDate(data.birth_date)} />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70 shadow-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-lg font-semibold tracking-tight">Estado de cuenta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <ProfileDetailRow icon={<IconCreditCard className="mt-0.5 h-4 w-4 text-muted-foreground" />} label="Plan actual" value={overview?.plan_name || "Sin plan asignado"} />
            <ProfileDetailRow
              icon={<IconCalendar className="mt-0.5 h-4 w-4 text-muted-foreground" />}
              label="Vigencia"
              value={`${formatDate(overview?.subscription_start_date)} - ${formatDate(overview?.subscription_end_date)}`}
            />
            <ProfileDetailRow icon={<IconCalendar className="mt-0.5 h-4 w-4 text-muted-foreground" />} label="Miembro desde" value={formatDate(data.created_at)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProfileMetricCard({
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

function ProfileDetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/35 px-3 py-3">
      {icon}
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}
