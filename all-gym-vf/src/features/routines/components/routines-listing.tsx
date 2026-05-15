import Link from "next/link";
import {
  IconBarbell,
  IconCalendar,
  IconListDetails,
  IconPlus,
  IconTargetArrow,
  IconUsers,
} from "@tabler/icons-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PRIMARY_GOAL_OPTIONS } from "@/lib/training/options";
import { cn } from "@/lib/utils";

import {
  getAllRoutineBlueprints,
  type BlueprintWithStats,
} from "../actions/blueprint-actions";
import { BlueprintRenameDialog } from "./blueprint-rename-dialog";

function getPrimaryGoalLabel(value: string | null) {
  if (!value) return null;
  return PRIMARY_GOAL_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

function getInitials(name: string | null) {
  const source = (name ?? "").trim();
  if (!source) return "?";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getTooltipLabel(name: string | null) {
  return name?.trim() || "Cliente";
}

function BlueprintCard({ blueprint }: { blueprint: BlueprintWithStats }) {
  const goalLabel = getPrimaryGoalLabel(blueprint.primary_goal);
  const updatedAt = formatDate(blueprint.updated_at ?? blueprint.created_at);
  const hasAssignments = blueprint.assignment_count > 0;
  const href = `/panel/rutinas/${blueprint.id}`;

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden border-border/70 transition-all hover:border-primary/40 hover:shadow-md">
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          {hasAssignments ? (
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300"
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {blueprint.assignment_count} asignado{blueprint.assignment_count !== 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 font-medium">
              Sin asignar
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            Plantilla
          </Badge>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconBarbell className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold leading-snug">
              {blueprint.name}
            </h3>
            {goalLabel ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <IconTargetArrow className="size-3.5" />
                <span className="truncate">{goalLabel}</span>
              </p>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 pb-3">
        {blueprint.preview_users.length > 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/40 p-2">
            <div className="flex items-center gap-1.5">
              <IconUsers className="size-3.5 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Asignado a
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1">
              {blueprint.preview_users.slice(0, 4).map((user, i) => (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <Avatar className="size-6 ring-2 ring-background">
                      <AvatarImage src={user.avatar ?? undefined} alt={getTooltipLabel(user.name)} />
                      <AvatarFallback className="text-[9px]">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>{getTooltipLabel(user.name)}</TooltipContent>
                </Tooltip>
              ))}
              {blueprint.assignment_count > 4 ? (
                <span className="ml-0.5 text-[11px] text-muted-foreground">
                  +{blueprint.assignment_count - 4}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Aún no asignada a ningún cliente
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/60 bg-background p-2">
            <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <IconCalendar className="size-3" /> Días
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {blueprint.day_count}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background p-2">
            <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <IconListDetails className="size-3" /> Ejercicios
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {blueprint.exercise_count}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          {updatedAt ? `Creada ${updatedAt}` : "Sin fecha"}
        </span>
        <div className="flex items-center gap-2">
          <BlueprintRenameDialog blueprintId={blueprint.id} currentName={blueprint.name} />
          <Button asChild size="sm" variant="ghost">
            <Link href={href}>Ver plantilla</Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <IconBarbell className="size-6" />
      </div>
      <div>
        <h3 className="text-base font-semibold">Aún no hay plantillas guardadas</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando generes o guardes plantillas de rutina, aparecerán aquí.
        </p>
      </div>
      <Button asChild>
        <Link href="/panel/rutinas/nueva">
          <IconPlus className="size-4" />
          Crear plantilla personalizada
        </Link>
      </Button>
    </div>
  );
}

export default async function RoutinesListing() {
  const blueprints = await getAllRoutineBlueprints();

  if (blueprints.length === 0) {
    return <EmptyState />;
  }

  const totals = blueprints.reduce(
    (acc, bp) => {
      if (bp.assignment_count > 0) acc.assigned += 1;
      else acc.unassigned += 1;
      return acc;
    },
    { assigned: 0, unassigned: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryTile label="Total" value={blueprints.length} accent="bg-primary/10 text-primary" />
        <SummaryTile
          label="Asignadas"
          value={totals.assigned}
          accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <SummaryTile
          label="Sin asignar"
          value={totals.unassigned}
          accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {blueprints.map((blueprint) => (
          <BlueprintCard key={blueprint.id} blueprint={blueprint} />
        ))}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3">
      <div className={cn("flex size-9 items-center justify-center rounded-lg", accent)}>
        <IconBarbell className="size-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  );
}
