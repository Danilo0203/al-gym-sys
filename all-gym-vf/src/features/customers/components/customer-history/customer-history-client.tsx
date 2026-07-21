"use client";

import Link from "next/link";
import {
  IconArrowLeft,
  IconCalendarStats,
  IconCoin,
  IconFingerprint,
  IconHeartbeat,
  IconScale,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CustomerDetail, CustomerHistoryResponse } from "@/features/customers/lib/local-customers";

interface CustomerHistoryClientProps {
  profile: CustomerDetail;
  history: CustomerHistoryResponse;
  membershipsPage: number;
  paymentsPage: number;
  assessmentsPage: number;
  onMembershipsPageChange: (page: number) => void;
  onPaymentsPageChange: (page: number) => void;
  onAssessmentsPageChange: (page: number) => void;
  isRefreshing: boolean;
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-GT", {
  timeZone: "America/Guatemala",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string | null) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

function formatCalendarDate(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function money(value: number | null) {
  return value === null ? "No disponible" : new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(value);
}

export function CustomerHistoryClient({
  profile,
  history,
  membershipsPage,
  paymentsPage,
  assessmentsPage,
  onMembershipsPageChange,
  onPaymentsPageChange,
  onAssessmentsPageChange,
  isRefreshing,
}: CustomerHistoryClientProps) {
  const initials = profile.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const membership = profile.current_membership;

  return (
    <div className="flex h-full flex-col bg-background/50">
      <header className="border-b bg-background p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="h-16 w-16 border-2">
              <AvatarImage src={profile.avatar_url ?? ""} alt={profile.full_name} />
              <AvatarFallback>{initials || "??"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold">{profile.full_name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={profile.is_active ? "success" : "secondary"}>{profile.is_active ? "Cliente activo" : "Cliente inactivo"}</Badge>
                <SubscriptionStatusBadge
                  status={membership?.status}
                  endDate={membership?.end_date}
                  graceDays={membership?.grace_days}
                  accessUntil={membership?.access_until}
                  displayStatus={profile.membership_status}
                />
                <Badge variant="outline"><IconFingerprint className="mr-1 h-3 w-3" />#{profile.biometric_id}</Badge>
                {isRefreshing ? <span className="text-xs text-muted-foreground">Actualizando…</span> : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Último ingreso: {formatDateTime(profile.last_check_in)}</p>
            </div>
          </div>
          <Link href="/panel/clientes"><Button variant="outline" size="sm"><IconArrowLeft className="mr-2 h-4 w-4" />Regresar</Button></Link>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-7xl space-y-10 p-6 pb-20">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi title="Total de visitas" value={String(history.kpis.total_visits)} icon={<IconCalendarStats />} />
            <Kpi title="Total gastado" value={money(history.kpis.total_spent)} icon={<IconCoin />} />
            <Kpi title="Peso inicial" value={history.kpis.initial_weight === null ? "N/D" : `${history.kpis.initial_weight} kg`} icon={<IconScale />} />
            <Kpi title="Peso actual" value={history.kpis.current_weight === null ? "N/D" : `${history.kpis.current_weight} kg`} icon={<IconHeartbeat />} />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Perfil y cuenta</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Correo" value={profile.account.email ?? "Sin correo"} />
                <Row label="Teléfono" value={profile.phone || "Sin teléfono"} />
                <Row label="Cuenta" value={profile.account.login_enabled ? "Acceso habilitado" : "Acceso deshabilitado"} />
                <Row label="Miembro desde" value={formatCalendarDate(history.kpis.member_since)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Membresía actual</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Plan" value={membership?.plan_name ?? "Sin plan"} />
                <Row label="Vigencia" value={membership ? `${formatCalendarDate(membership.start_date)} – ${formatCalendarDate(membership.end_date)}` : "—"} />
                <Row label="Acceso hasta" value={formatCalendarDate(membership?.access_until ?? null)} />
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <SectionTitle title="Historial de membresías" />
            <Card><CardContent className="p-0"><MembershipsTable history={history} /></CardContent></Card>
            <Pagination meta={history.memberships.meta} page={membershipsPage} onChange={onMembershipsPageChange} />
          </section>

          {history.payments ? (
            <section className="space-y-4">
              <SectionTitle title="Pagos publicados" />
              <Card><CardContent className="p-0"><PaymentsTable history={history} /></CardContent></Card>
              <Pagination meta={history.payments.meta} page={paymentsPage} onChange={onPaymentsPageChange} />
            </section>
          ) : null}

          <section className="space-y-4">
            <SectionTitle title="Asistencias" />
            <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
              <Card>
                <CardHeader><CardTitle className="text-base">Últimos ingresos ({history.attendance.data.length}/{history.attendance.total})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {history.attendance.data.length === 0 ? <Empty label="Sin asistencias" /> : history.attendance.data.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 border-b py-2 last:border-0">
                      <span className="text-sm">{formatDateTime(entry.check_in_time)}</span>
                      <Badge variant={entry.status === "authorized" ? "success" : "destructive"}>{entry.status === "authorized" ? "Autorizado" : "Denegado"}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Heatmap history={history} />
            </div>
          </section>

          <section className="space-y-4">
            <SectionTitle title="Evaluaciones" />
            <Card><CardContent className="p-0"><AssessmentsTable history={history} /></CardContent></Card>
            <Pagination meta={history.assessments.meta} page={assessmentsPage} onChange={onAssessmentsPageChange} />
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function Kpi({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return <Card><CardContent className="flex items-center gap-4 p-5"><span className="rounded-lg bg-primary/10 p-3 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span><div><p className="text-xs uppercase text-muted-foreground">{title}</p><p className="text-xl font-bold">{value}</p></div></CardContent></Card>;
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-xl font-bold">{title}</h2>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-b py-2 last:border-0"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

function Empty({ label }: { label: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{label}</p>;
}

function MembershipsTable({ history }: { history: CustomerHistoryResponse }) {
  if (history.memberships.data.length === 0) return <Empty label="Sin membresías" />;
  return (
    <Table><TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Vigencia</TableHead><TableHead>Acceso hasta</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader>
      <TableBody>{history.memberships.data.map((entry) => <TableRow key={entry.id}><TableCell>{entry.plan_name ?? `Plan #${entry.plan_id}`}</TableCell><TableCell>{formatCalendarDate(entry.start_date)} – {formatCalendarDate(entry.end_date)}</TableCell><TableCell>{formatCalendarDate(entry.access_until)}</TableCell><TableCell><Badge variant="outline">{entry.status}</Badge></TableCell><TableCell className="text-right">{money(entry.price - entry.discount_amount)}</TableCell></TableRow>)}</TableBody>
    </Table>
  );
}

function PaymentsTable({ history }: { history: CustomerHistoryResponse }) {
  if (!history.payments || history.payments.data.length === 0) return <Empty label="Sin pagos publicados" />;
  return (
    <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Plan</TableHead><TableHead>Método</TableHead><TableHead className="text-right">Original</TableHead><TableHead className="text-right">Descuento</TableHead><TableHead className="text-right">Pagado</TableHead></TableRow></TableHeader>
      <TableBody>{history.payments.data.map((entry) => <TableRow key={entry.id}><TableCell>{formatDateTime(entry.payment_date)}</TableCell><TableCell>{entry.plan_name ?? "Sin plan relacionado"}</TableCell><TableCell>{entry.method ?? "Sin método"}</TableCell><TableCell className="text-right">{money(entry.amount_original)}</TableCell><TableCell className="text-right">{money(entry.discount_amount)}</TableCell><TableCell className="text-right font-medium">{money(entry.amount_paid)}</TableCell></TableRow>)}</TableBody>
    </Table>
  );
}

function AssessmentsTable({ history }: { history: CustomerHistoryResponse }) {
  if (history.assessments.data.length === 0) return <Empty label="Sin evaluaciones" />;
  return (
    <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Peso</TableHead><TableHead>Estatura</TableHead><TableHead>Grasa</TableHead><TableHead>Músculo</TableHead><TableHead>Cintura</TableHead></TableRow></TableHeader>
      <TableBody>{history.assessments.data.map((entry) => <TableRow key={entry.id}><TableCell>{formatCalendarDate(entry.assessment_date)}</TableCell><TableCell>{entry.weight_kg ?? "—"} kg</TableCell><TableCell>{entry.height_cm ?? "—"} cm</TableCell><TableCell>{entry.body_fat_percentage ?? "—"}%</TableCell><TableCell>{entry.muscle_mass_kg ?? "—"} kg</TableCell><TableCell>{entry.waist ?? "—"} cm</TableCell></TableRow>)}</TableBody>
    </Table>
  );
}

function Heatmap({ history }: { history: CustomerHistoryResponse }) {
  const counts = new Map(history.heatmap.data.map((entry) => [entry.date, entry.count]));
  const start = new Date(`${history.heatmap.from}T12:00:00`);
  const days = Array.from({ length: history.heatmap.days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { key, count: counts.get(key) ?? 0 };
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Heatmap ({history.heatmap.timezone})</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-2" aria-label={`Asistencias del ${history.heatmap.from} al ${history.heatmap.to}`}>
          {days.map(({ key, count }) => <span key={key} title={`${key}: ${count}`} className={`h-3 w-3 rounded-sm ${count === 0 ? "bg-muted" : count === 1 ? "bg-emerald-300" : count <= 3 ? "bg-emerald-500" : "bg-emerald-700"}`} />)}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{formatCalendarDate(history.heatmap.from)} – {formatCalendarDate(history.heatmap.to)} · fechas locales de Guatemala</p>
      </CardContent>
    </Card>
  );
}

function Pagination({ meta, page, onChange }: { meta: { total: number; total_pages: number }; page: number; onChange: (page: number) => void }) {
  if (meta.total_pages <= 1) return null;
  return <div className="flex items-center justify-end gap-3"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button><span className="text-sm text-muted-foreground">Página {page} de {meta.total_pages} · {meta.total} registros</span><Button size="sm" variant="outline" disabled={page >= meta.total_pages} onClick={() => onChange(page + 1)}>Siguiente</Button></div>;
}
