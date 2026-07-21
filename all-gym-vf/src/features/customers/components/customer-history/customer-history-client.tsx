"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  IconActivity,
  IconArrowLeft,
  IconCalendarStats,
  IconChartLine,
  IconCoin,
  IconCreditCard,
  IconFileCertificate,
  IconFingerprint,
  IconMail,
  IconMinus,
  IconPhone,
  IconRun,
  IconScale,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CustomerDetail, CustomerHistoryResponse } from "@/features/customers/lib/local-customers";
import { cn } from "@/lib/utils";

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

const sectionIds = ["overview", "profile", "memberships", "payments", "attendance", "assessments"] as const;

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
  return value === null
    ? "No disponible"
    : new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(value);
}

function membershipHeaderMeta(status: CustomerDetail["membership_status"]) {
  const values = {
    active: { label: "Plan al día", tone: "success" as const },
    expiring: { label: "Plan por vencer", tone: "warning" as const },
    grace: { label: "Plan en prórroga", tone: "warning" as const },
    expired: { label: "Plan vencido", tone: "danger" as const },
    cancelled: { label: "Plan cancelado", tone: "danger" as const },
    none: { label: "Sin plan", tone: "muted" as const },
  };

  return values[status];
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
  const [activeSection, setActiveSection] = useState<(typeof sectionIds)[number]>("overview");
  const contentRef = useRef<HTMLDivElement>(null);
  const initials = profile.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const membership = profile.current_membership;
  const membershipMeta = membershipHeaderMeta(profile.membership_status);

  useEffect(() => {
    const breadcrumbPage = document.querySelector<HTMLElement>("[data-slot='breadcrumb-page']");
    if (!breadcrumbPage || breadcrumbPage.textContent?.trim() !== "History") return;

    breadcrumbPage.textContent = "Historial";
    return () => {
      if (breadcrumbPage.textContent === "Historial") breadcrumbPage.textContent = "History";
    };
  }, []);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const handleScroll = () => {
      const activationPoint = content.getBoundingClientRect().top + 160;
      let nextSection: (typeof sectionIds)[number] = "overview";

      for (const sectionId of sectionIds) {
        const section = document.getElementById(sectionId);
        if (section && section.getBoundingClientRect().top <= activationPoint) nextSection = sectionId;
      }

      setActiveSection(nextSection);
    };

    handleScroll();
    content.addEventListener("scroll", handleScroll, { passive: true });
    return () => content.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: (typeof sectionIds)[number]) => {
    const content = contentRef.current;
    const section = document.getElementById(sectionId);
    if (!content || !section) return;

    const top = content.scrollTop + section.getBoundingClientRect().top - content.getBoundingClientRect().top - 12;
    content.scrollTo({ top, behavior: "smooth" });
    setActiveSection(sectionId);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background/50">
      <header className="z-10 shrink-0 border-b bg-gradient-to-b from-background via-background to-muted/20 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:p-6">
          <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
              <div className="group relative shrink-0">
                <Avatar className="h-14 w-14 border-4 border-background shadow-lg transition-transform duration-300 group-hover:scale-105 sm:h-16 sm:w-16">
                  <AvatarImage src={profile.avatar_url ?? ""} alt={profile.full_name} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-lg font-black text-primary-foreground">
                    {initials || "??"}
                  </AvatarFallback>
                </Avatar>
                {profile.is_active ? (
                  <span
                    className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-green-500 shadow-lg"
                    title="Cliente activo"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                  <h1 className="min-w-0 truncate text-xl font-black leading-none tracking-tight sm:text-2xl">
                    {profile.full_name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <HeaderStatusText
                      tone={profile.is_active ? "success" : "muted"}
                      label={profile.is_active ? "Cliente activo" : "Cliente inactivo"}
                    />
                    <HeaderStatusText tone={membershipMeta.tone} label={membershipMeta.label} />
                  </div>
                </div>

                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                    <HeaderInlineMeta icon={<IconMail />} label={profile.account.email ?? "Sin correo"} />
                    <HeaderSeparator />
                    <HeaderInlineMeta icon={<IconPhone />} label={profile.phone || "Sin teléfono"} />
                    <HeaderSeparator />
                    <HeaderInlineMeta icon={<IconFingerprint />} label={`Biométrico #${profile.biometric_id}`} />
                  </div>
                  <HeaderInlineMeta
                    icon={<IconCalendarStats />}
                    label={`Último ingreso: ${formatDateTime(profile.last_check_in)}`}
                  />
                </div>
              </div>
            </div>

            <div className="flex w-full shrink-0 items-center gap-2 xl:w-auto xl:justify-end">
              {isRefreshing ? <span className="text-xs text-muted-foreground">Actualizando…</span> : null}
              <Link href="/panel/clientes" className="flex-1 sm:flex-none">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full gap-2 border-primary/10 px-3 text-[10px] font-bold uppercase tracking-tighter hover:bg-primary/5 sm:w-auto"
                >
                  <IconArrowLeft className="h-3.5 w-3.5" />
                  Regresar
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <nav className="flex max-w-full items-center gap-1 overflow-x-auto px-4 pb-0 sm:px-5 lg:px-6" aria-label="Secciones del historial">
          <NavTab active={activeSection === "overview"} onClick={() => scrollToSection("overview")} label="Resumen" icon={<IconChartLine />} />
          <NavTab active={activeSection === "profile"} onClick={() => scrollToSection("profile")} label="Perfil" icon={<IconActivity />} />
          <NavTab active={activeSection === "memberships"} onClick={() => scrollToSection("memberships")} label="Membresías" icon={<IconFileCertificate />} />
          {history.payments ? <NavTab active={activeSection === "payments"} onClick={() => scrollToSection("payments")} label="Finanzas" icon={<IconCoin />} /> : null}
          <NavTab active={activeSection === "attendance"} onClick={() => scrollToSection("attendance")} label="Accesos" icon={<IconRun />} />
          <NavTab active={activeSection === "assessments"} onClick={() => scrollToSection("assessments")} label="Evaluaciones" icon={<IconScale />} />
        </nav>
      </header>

      <div
        ref={contentRef}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
        data-testid="customer-history-scroll-panel"
      >
        <div className="mx-auto w-full min-w-0 max-w-7xl space-y-16 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-10">
          <section id="overview" className="min-w-0 scroll-mt-4">
            <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard title="Total Gastado (LTV)" value={money(history.kpis.total_spent)} icon={<IconCoin />} description="Valor acumulado histórico" trend="Finanzas" variant="emerald" />
              <KpiCard title="Total de Visitas" value={String(history.kpis.total_visits)} icon={<IconCalendarStats />} description="Ingresos registrados" trend="Actividad" variant="blue" />
              <KpiCard title="Peso Actual" value={history.kpis.current_weight === null ? "N/D" : `${history.kpis.current_weight} kg`} icon={<IconScale />} description={history.kpis.initial_weight === null ? "Sin registro inicial" : `Inicial: ${history.kpis.initial_weight} kg`} trend="Salud" variant="purple" />
              <KpiCard
                title="Cambio de Peso"
                value={history.kpis.weight_change === null ? "N/A" : `${history.kpis.weight_change > 0 ? "+" : ""}${history.kpis.weight_change.toFixed(1)} kg`}
                icon={history.kpis.weight_change === null ? <IconMinus /> : history.kpis.weight_change > 0 ? <IconTrendingUp /> : history.kpis.weight_change < 0 ? <IconTrendingDown /> : <IconMinus />}
                description="Desde ingreso"
                trend="Evolución"
                variant={history.kpis.weight_change && history.kpis.weight_change > 0 ? "orange" : "emerald"}
              />
            </div>
          </section>

          <section id="profile" className="min-w-0 scroll-mt-4 space-y-6">
            <SectionHeader icon={<IconActivity />} title="Perfil y cuenta" />
            <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
              <OverviewCard title="Perfil y cuenta" icon={<IconActivity />}>
                <Row label="Correo" value={profile.account.email ?? "Sin correo"} />
                <Row label="Teléfono" value={profile.phone || "Sin teléfono"} />
                <Row label="Cuenta" value={profile.account.login_enabled ? "Acceso habilitado" : "Acceso deshabilitado"} />
                <Row label="Credenciales" value={profile.account.has_password ? "Configuradas" : "No configuradas"} />
                <Row label="Miembro desde" value={formatCalendarDate(history.kpis.member_since)} />
              </OverviewCard>
              <OverviewCard title="Membresía actual" icon={<IconFileCertificate />}>
                <Row label="Plan" value={membership?.plan_name ?? "Sin plan"} />
                <Row label="Inicio" value={formatCalendarDate(membership?.start_date ?? null)} />
                <Row label="Finaliza" value={formatCalendarDate(membership?.end_date ?? null)} />
                <Row label="Acceso hasta" value={formatCalendarDate(membership?.access_until ?? null)} />
                <Row label="Estado" value={membershipMeta.label} />
              </OverviewCard>
            </div>
          </section>

          <section id="memberships" className="min-w-0 scroll-mt-4 space-y-6">
            <SectionHeader icon={<IconFileCertificate />} title="Membresías y Planes" />
            <HistoryCard title="Historial de membresías" description="Seguimiento de planes y períodos de vigencia">
              <MembershipsTable history={history} />
            </HistoryCard>
            <Pagination meta={history.memberships.meta} page={membershipsPage} onChange={onMembershipsPageChange} />
          </section>

          {history.payments ? (
            <section id="payments" className="min-w-0 scroll-mt-4 space-y-6">
              <SectionHeader icon={<IconCreditCard />} title="Historial Financiero" />
              <HistoryCard title="Pagos publicados" description="Transacciones disponibles según tus permisos">
                <PaymentsTable history={history} />
              </HistoryCard>
              <Pagination meta={history.payments.meta} page={paymentsPage} onChange={onPaymentsPageChange} />
            </section>
          ) : null}

          <section id="attendance" className="min-w-0 scroll-mt-4 space-y-6">
            <SectionHeader icon={<IconRun />} title="Control de Asistencia" />
            <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <Card className="min-w-0 overflow-hidden border-primary/10 bg-card/80 shadow-sm">
                <CardHeader className="border-b border-primary/5 bg-muted/30">
                  <CardTitle className="text-base">Últimos ingresos ({history.attendance.data.length}/{history.attendance.total})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-5">
                  {history.attendance.data.length === 0 ? <Empty label="Sin asistencias" /> : history.attendance.data.map((entry) => (
                    <div key={entry.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b py-2 last:border-0">
                      <span className="min-w-0 text-sm">{formatDateTime(entry.check_in_time)}</span>
                      <Badge variant={entry.status === "authorized" ? "success" : "destructive"}>{entry.status === "authorized" ? "Autorizado" : "Denegado"}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Heatmap history={history} />
            </div>
          </section>

          <section id="assessments" className="min-w-0 scroll-mt-4 space-y-6">
            <SectionHeader icon={<IconScale />} title="Progreso Somatométrico" />
            <HistoryCard title="Evaluaciones" description="Historial de mediciones existentes">
              <AssessmentsTable history={history} />
            </HistoryCard>
            <Pagination meta={history.assessments.meta} page={assessmentsPage} onChange={onAssessmentsPageChange} />
          </section>
        </div>
      </div>
    </div>
  );
}

function HeaderStatusText({ tone, label }: { tone: "success" | "warning" | "danger" | "muted"; label: string }) {
  const tones = { success: "text-emerald-500", warning: "text-amber-500", danger: "text-rose-500", muted: "text-muted-foreground" };
  return <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", tones[tone])}><span className="h-1.5 w-1.5 rounded-full bg-current" /><span className="text-xs font-medium tracking-wide">{label}</span></span>;
}

function HeaderInlineMeta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm text-muted-foreground"><span className="shrink-0 text-foreground/65 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span><span className="min-w-0 truncate font-medium">{label}</span></div>;
}

function HeaderSeparator() {
  return <span className="hidden h-1 w-1 shrink-0 rounded-full bg-muted-foreground/30 sm:inline-block" aria-hidden="true" />;
}

function NavTab({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-[10px] font-bold uppercase tracking-widest outline-none transition-all sm:text-[11px]", active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:border-muted hover:text-foreground")}><span className={cn("[&>svg]:h-4 [&>svg]:w-4", active && "scale-110")}>{icon}</span>{label}</button>;
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="flex min-w-0 items-center gap-3"><div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary shadow-sm shadow-primary/5 [&>svg]:h-5 [&>svg]:w-5">{icon}</div><h2 className="min-w-0 text-xl font-black tracking-tight">{title}</h2><div className="ml-2 h-px min-w-0 flex-1 bg-gradient-to-r from-primary/20 to-transparent sm:ml-4" /></div>;
}

function KpiCard({ title, value, icon, description, trend, variant }: { title: string; value: string; icon: React.ReactNode; description: string; trend: string; variant: "emerald" | "blue" | "purple" | "orange" }) {
  const styles = {
    emerald: { card: "border-emerald-500/10 hover:border-emerald-500/20", icon: "bg-emerald-500/10 text-emerald-600", trend: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600", line: "bg-emerald-500" },
    blue: { card: "border-blue-500/10 hover:border-blue-500/20", icon: "bg-blue-500/10 text-blue-600", trend: "border-blue-500/20 bg-blue-500/10 text-blue-600", line: "bg-blue-500" },
    purple: { card: "border-purple-500/10 hover:border-purple-500/20", icon: "bg-purple-500/10 text-purple-600", trend: "border-purple-500/20 bg-purple-500/10 text-purple-600", line: "bg-purple-500" },
    orange: { card: "border-orange-500/10 hover:border-orange-500/20", icon: "bg-orange-500/10 text-orange-600", trend: "border-orange-500/20 bg-orange-500/10 text-orange-600", line: "bg-orange-500" },
  };
  const style = styles[variant];
  return <Card className={cn("group relative min-w-0 overflow-hidden border bg-card shadow-sm transition-all duration-300 hover:shadow-md", style.card)}><span className={cn("absolute inset-y-0 left-0 w-1 opacity-80", style.line)} /><CardHeader className="flex min-w-0 flex-row items-center justify-between gap-3 pb-2"><div className="min-w-0 space-y-1.5"><CardTitle className="truncate text-[10px] font-black uppercase tracking-wider text-muted-foreground">{title}</CardTitle><Badge variant="outline" className={cn("h-4 max-w-full truncate px-1.5 text-[8px] font-bold uppercase", style.trend)}>{trend}</Badge></div><div className={cn("shrink-0 rounded-xl p-2 transition-transform duration-300 group-hover:scale-110 [&>svg]:h-6 [&>svg]:w-6", style.icon)}>{icon}</div></CardHeader><CardContent className="min-w-0"><p className="break-words text-2xl font-black tracking-tight">{value}</p><p className="mt-1 break-words text-xs text-muted-foreground">{description}</p></CardContent></Card>;
}

function OverviewCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Card className="min-w-0 overflow-hidden border-primary/10 bg-card/80 shadow-sm"><CardHeader className="border-b border-primary/5 bg-muted/30"><CardTitle className="flex items-center gap-3 text-base"><span className="rounded-lg bg-primary/10 p-2 text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span>{title}</CardTitle></CardHeader><CardContent className="space-y-1 p-5 text-sm">{children}</CardContent></Card>;
}

function HistoryCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Card className="min-w-0 overflow-hidden border-primary/10 bg-card/80 shadow-sm"><CardHeader className="border-b border-primary/5 bg-muted/30"><CardTitle>{title}</CardTitle><p className="text-sm text-muted-foreground">{description}</p></CardHeader><CardContent className="min-w-0 p-0"><div className="w-full min-w-0 overflow-x-auto">{children}</div></CardContent></Card>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-0 flex-col justify-between gap-1 border-b py-2 last:border-0 sm:flex-row sm:gap-4"><span className="text-muted-foreground">{label}</span><span className="min-w-0 break-words font-medium sm:text-right">{value}</span></div>;
}

function Empty({ label }: { label: string }) {
  return <p className="min-w-[240px] py-12 text-center text-sm text-muted-foreground">{label}</p>;
}

function MembershipsTable({ history }: { history: CustomerHistoryResponse }) {
  if (history.memberships.data.length === 0) return <Empty label="Sin membresías" />;
  return <Table className="min-w-[720px]"><TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Vigencia</TableHead><TableHead>Acceso hasta</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader><TableBody>{history.memberships.data.map((entry) => <TableRow key={entry.id}><TableCell className="font-medium">{entry.plan_name ?? `Plan #${entry.plan_id}`}</TableCell><TableCell className="whitespace-nowrap">{formatCalendarDate(entry.start_date)} – {formatCalendarDate(entry.end_date)}</TableCell><TableCell className="whitespace-nowrap">{formatCalendarDate(entry.access_until)}</TableCell><TableCell><Badge variant="outline">{entry.status}</Badge></TableCell><TableCell className="whitespace-nowrap text-right font-medium">{money(entry.price - entry.discount_amount)}</TableCell></TableRow>)}</TableBody></Table>;
}

function PaymentsTable({ history }: { history: CustomerHistoryResponse }) {
  if (!history.payments || history.payments.data.length === 0) return <Empty label="Sin pagos publicados" />;
  return <Table className="min-w-[820px]"><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Plan</TableHead><TableHead>Método</TableHead><TableHead className="text-right">Original</TableHead><TableHead className="text-right">Descuento</TableHead><TableHead className="text-right">Pagado</TableHead></TableRow></TableHeader><TableBody>{history.payments.data.map((entry) => <TableRow key={entry.id}><TableCell className="whitespace-nowrap">{formatDateTime(entry.payment_date)}</TableCell><TableCell>{entry.plan_name ?? "Sin plan relacionado"}</TableCell><TableCell>{entry.method ?? "Sin método"}</TableCell><TableCell className="whitespace-nowrap text-right">{money(entry.amount_original)}</TableCell><TableCell className="whitespace-nowrap text-right">{money(entry.discount_amount)}</TableCell><TableCell className="whitespace-nowrap text-right font-black text-emerald-600">{money(entry.amount_paid)}</TableCell></TableRow>)}</TableBody></Table>;
}

function AssessmentsTable({ history }: { history: CustomerHistoryResponse }) {
  if (history.assessments.data.length === 0) return <Empty label="Sin evaluaciones" />;
  return <Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Peso</TableHead><TableHead>Estatura</TableHead><TableHead>Grasa</TableHead><TableHead>Músculo</TableHead><TableHead>Cintura</TableHead></TableRow></TableHeader><TableBody>{history.assessments.data.map((entry) => <TableRow key={entry.id}><TableCell className="whitespace-nowrap">{formatCalendarDate(entry.assessment_date)}</TableCell><TableCell>{entry.weight_kg ?? "—"} kg</TableCell><TableCell>{entry.height_cm ?? "—"} cm</TableCell><TableCell>{entry.body_fat_percentage ?? "—"}%</TableCell><TableCell>{entry.muscle_mass_kg ?? "—"} kg</TableCell><TableCell>{entry.waist ?? "—"} cm</TableCell></TableRow>)}</TableBody></Table>;
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

  return <Card className="min-w-0 overflow-hidden border-primary/10 bg-card/80 shadow-sm"><CardHeader className="border-b border-primary/5 bg-muted/30"><CardTitle className="text-base">Mapa de actividad</CardTitle><p className="text-xs text-muted-foreground">Zona horaria: {history.heatmap.timezone}</p></CardHeader><CardContent className="min-w-0 p-5"><div className="w-full min-w-0 overflow-x-auto pb-2"><div className="grid w-max grid-flow-col grid-rows-7 gap-1" aria-label={`Asistencias del ${history.heatmap.from} al ${history.heatmap.to}`}>{days.map(({ key, count }) => <span key={key} title={`${key}: ${count}`} className={cn("h-3 w-3 rounded-sm", count === 0 ? "bg-muted" : count === 1 ? "bg-emerald-300" : count <= 3 ? "bg-emerald-500" : "bg-emerald-700")} />)}</div></div><p className="mt-3 text-xs text-muted-foreground">{formatCalendarDate(history.heatmap.from)} – {formatCalendarDate(history.heatmap.to)} · fechas locales de Guatemala</p></CardContent></Card>;
}

function Pagination({ meta, page, onChange }: { meta: { total: number; total_pages: number }; page: number; onChange: (page: number) => void }) {
  if (meta.total_pages <= 1) return null;
  return <div className="flex min-w-0 flex-wrap items-center justify-end gap-3"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button><span className="text-center text-sm text-muted-foreground">Página {page} de {meta.total_pages} · {meta.total} registros</span><Button size="sm" variant="outline" disabled={page >= meta.total_pages} onClick={() => onChange(page + 1)}>Siguiente</Button></div>;
}
