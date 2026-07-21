"use client";

import { IconFingerprint, IconId, IconMail, IconPhone, IconUser } from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { useCustomer } from "@/features/customers/hooks/use-customers";

interface CustomerViewPageProps {
  customerId: string;
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function CustomerViewPage({ customerId }: CustomerViewPageProps) {
  const customerQuery = useCustomer(customerId);

  if (customerQuery.isPending) {
    return <div className="min-h-64 animate-pulse rounded-xl border bg-muted/30" />;
  }

  if (customerQuery.isError) {
    const status = "status" in customerQuery.error ? customerQuery.error.status : null;
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
          <div>
            <p className="font-semibold">{status === 404 ? "Cliente no encontrado" : "No se pudo cargar el cliente"}</p>
            <p className="text-sm text-muted-foreground">{customerQuery.error.message}</p>
          </div>
          <Button variant="outline" onClick={() => customerQuery.refetch()}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  const customer = customerQuery.data;
  const membership = customer.current_membership;
  const accountStatus = customer.account.login_enabled ? "Acceso configurado" : "Acceso pendiente";
  const credentialsStatus = customer.account.login_enabled
    ? "Correo y contraseña configurados"
    : customer.account.email && !customer.account.has_password
      ? "Tiene correo y no tiene contraseña"
      : !customer.account.email
        ? "No tiene correo configurado"
        : "Contraseña registrada; acceso pendiente";
  const initials = customer.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={customer.avatar_url ?? ""} alt={customer.full_name} />
              <AvatarFallback>{initials || "??"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold">{customer.full_name}</h1>
              <p className="text-sm text-muted-foreground">{customer.role}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={customer.is_active ? "success" : "secondary"}>
                  {customer.is_active ? "Cliente activo" : "Cliente inactivo"}
                </Badge>
                <SubscriptionStatusBadge
                  status={membership?.status}
                  endDate={membership?.end_date}
                  graceDays={membership?.grace_days}
                  accessUntil={membership?.access_until}
                  displayStatus={customer.membership_status}
                />
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Último ingreso: <span className="font-medium text-foreground">{formatDateTime(customer.last_check_in)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Perfil básico</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info icon={<IconUser />} label="Nombre" value={customer.full_name} />
            <Info icon={<IconPhone />} label="Teléfono" value={customer.phone || "Sin teléfono"} />
            <Info icon={<IconMail />} label="Correo" value={customer.email ?? "Sin correo"} />
            <Info icon={<IconFingerprint />} label="Biométrico" value={`#${customer.biometric_id}`} />
            <Info icon={<IconId />} label="Nacimiento" value={customer.birth_date} />
            <Info icon={<IconUser />} label="Género" value={customer.gender} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cuenta</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Correo de acceso" value={customer.account.email ?? "Sin correo configurado"} />
            <Row label="Estado" value={accountStatus} />
            <Row label="Credenciales" value={credentialsStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Membresía actual</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Plan" value={membership?.plan_name ?? "Sin plan"} />
            <Row label="Inicio" value={membership?.start_date ?? "—"} />
            <Row label="Fin" value={membership?.end_date ?? "—"} />
            <Row label="Acceso hasta" value={membership?.access_until ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Capacidades</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Capability enabled={customer.capabilities.update_customer} label="Editar cliente" />
            <Capability enabled={customer.capabilities.manage_account} label="Administrar cuenta" />
            <Capability enabled={customer.capabilities.manage_membership} label="Gestionar membresía" />
            <Capability enabled={customer.capabilities.view_payments} label="Ver pagos" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value}</p></div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-b pb-2 last:border-0"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

function Capability({ enabled, label }: { enabled: boolean; label: string }) {
  return <Badge variant={enabled ? "success" : "secondary"}>{label}: {enabled ? "disponible" : "no disponible"}</Badge>;
}
