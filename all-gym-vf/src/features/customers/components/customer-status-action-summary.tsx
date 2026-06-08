"use client";

import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  IconCalendarClock,
  IconCreditCard,
  IconPhone,
  IconShieldCheck,
  IconShieldLock,
} from "@tabler/icons-react";

interface CustomerStatusActionSummaryProps {
  customerName: string | null | undefined;
  isActive: boolean;
  phone?: string | null;
  planName?: string | null;
  subscriptionStatus?: string | null;
  subscriptionEndDate?: string | null;
  subscriptionGraceDays?: number | null;
  subscriptionAccessUntil?: string | null;
}

function formatEndDate(value?: string | null) {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span className="text-foreground/80">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export function CustomerStatusActionSummary({
  customerName,
  isActive,
  phone,
  planName,
  subscriptionStatus,
  subscriptionEndDate,
  subscriptionGraceDays,
  subscriptionAccessUntil,
}: CustomerStatusActionSummaryProps) {
  const actionTone = isActive
    ? {
        panelClassName: "border-destructive/30 bg-destructive/8",
        iconClassName: "bg-destructive/14 text-destructive",
        badgeVariant: "destructive" as const,
        badgeLabel: "Se bloqueará el acceso",
        title: "Cambio inmediato al confirmar",
        description:
          "El cliente pasará a estado inactivo y el reloj dejará de permitir su ingreso hasta que lo reactives.",
        stateBadge: <Badge variant="success">Activo</Badge>,
        outcome:
          "Podrás reactivarlo más tarde y recuperar su acceso sin perder su ficha dentro del sistema.",
      }
    : {
        panelClassName: "border-emerald-500/30 bg-emerald-500/8",
        iconClassName: "bg-emerald-500/14 text-emerald-400",
        badgeVariant: "success" as const,
        badgeLabel: "Se restaurará el acceso",
        title: "Reactivación lista para confirmar",
        description:
          "El cliente volverá a estado activo y se habilitará nuevamente para ingreso en el reloj del gimnasio.",
        stateBadge: <Badge variant="secondary">Inactivo</Badge>,
        outcome: "El sistema volverá a sincronizar su acceso y quedará listo para seguir usando el plan actual.",
      };

  return (
    <div className="space-y-5">
      <div className={cn("rounded-3xl border p-5", actionTone.panelClassName)}>
        <div className="flex items-start gap-4">
          <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", actionTone.iconClassName)}>
            {isActive ? <IconShieldLock className="size-6" /> : <IconShieldCheck className="size-6" />}
          </div>
          <div className="min-w-0 space-y-2">
            <Badge variant={actionTone.badgeVariant} className="rounded-full px-3 py-1 text-[11px] font-semibold">
              {actionTone.badgeLabel}
            </Badge>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">{actionTone.title}</p>
              <p className="text-sm leading-6 text-muted-foreground">
                El cliente <span className="font-semibold text-foreground">{customerName || "Sin nombre"}</span>.{" "}
                {actionTone.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard
          icon={isActive ? <IconShieldLock className="size-4" /> : <IconShieldCheck className="size-4" />}
          label="Estado actual"
          value={actionTone.stateBadge}
        />
        <SummaryCard
          icon={<IconCreditCard className="size-4" />}
          label="Suscripción"
          value={<SubscriptionStatusBadge status={subscriptionStatus} endDate={subscriptionEndDate} graceDays={subscriptionGraceDays} accessUntil={subscriptionAccessUntil} />}
        />
        <SummaryCard icon={<IconPhone className="size-4" />} label="Teléfono" value={phone || "Sin teléfono"} />
        <SummaryCard
          icon={<IconCalendarClock className="size-4" />}
          label="Vencimiento"
          value={formatEndDate(subscriptionEndDate)}
        />
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
        <div className="mb-2 text-sm font-semibold text-foreground">Contexto del plan</div>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{planName || "Sin plan asignado"}</span>
          <span className="mx-2 text-border">•</span>
          {actionTone.outcome}
        </div>
      </div>
    </div>
  );
}
