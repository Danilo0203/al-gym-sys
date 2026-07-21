"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { IconInfoCircle, IconPhone, IconShieldCheck, IconShieldLock } from "@tabler/icons-react";

interface CustomerStatusActionSummaryProps {
  customerName: string | null | undefined;
  isActive: boolean;
  phone?: string | null;
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
}: CustomerStatusActionSummaryProps) {
  const tone = isActive
    ? {
        panelClassName: "border-destructive/30 bg-destructive/8",
        iconClassName: "bg-destructive/14 text-destructive",
        badgeLabel: "Se suspenderá en ALGYM",
        title: "Cambio listo para confirmar",
        description: "El cliente quedará inactivo dentro del sistema administrativo.",
        stateBadge: <Badge variant="success">Activo</Badge>,
      }
    : {
        panelClassName: "border-emerald-500/30 bg-emerald-500/8",
        iconClassName: "bg-emerald-500/14 text-emerald-400",
        badgeLabel: "Se reactivará en ALGYM",
        title: "Reactivación lista para confirmar",
        description: "El cliente volverá a estado activo dentro del sistema administrativo.",
        stateBadge: <Badge variant="secondary">Inactivo</Badge>,
      };

  return (
    <div className="space-y-5">
      <div className={cn("rounded-3xl border p-5", tone.panelClassName)}>
        <div className="flex items-start gap-4">
          <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", tone.iconClassName)}>
            {isActive ? <IconShieldLock className="size-6" /> : <IconShieldCheck className="size-6" />}
          </div>
          <div className="min-w-0 space-y-2">
            <Badge className="rounded-full px-3 py-1 text-[11px] font-semibold">{tone.badgeLabel}</Badge>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">{tone.title}</p>
              <p className="text-sm leading-6 text-muted-foreground">
                El cliente <span className="font-semibold text-foreground">{customerName || "Sin nombre"}</span>.{" "}
                {tone.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard
          icon={isActive ? <IconShieldLock className="size-4" /> : <IconShieldCheck className="size-4" />}
          label="Estado actual"
          value={tone.stateBadge}
        />
        <SummaryCard icon={<IconPhone className="size-4" />} label="Teléfono" value={phone || "Sin teléfono"} />
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconInfoCircle className="size-4" />
          <span>Importante en Fase A</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Esta acción actualiza `profiles.is_active` en el backend local. Todavía no sincroniza reloj biométrico,
          membresías ni pagos.
        </div>
      </div>
    </div>
  );
}
