"use client";

import {
  IconBarbell,
  IconChecklist,
  IconClockHour4,
  IconMoodSmile,
  IconSparkles,
  IconTargetArrow,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientErrorState, ClientLoadingState } from "@/features/client/components/client-resource-state";
import { ClientSyncStatus } from "@/features/client/components/client-sync-status";
import { useClientRoutine } from "@/features/client/hooks/use-client-api";
import {
  buildTrainingContextHelper,
  getPrimaryGoalLabel,
  getRoutineDayCount,
  getRoutineExerciseCount,
  getStatusBadgeVariant,
  getStatusLabel,
  RoutineViewer,
} from "@/features/customers/components/customer-history/tabs/routine-workspace-shared";

export function ClientRoutineScreen() {
  const routineQuery = useClientRoutine();

  if (routineQuery.isPending) {
    return <ClientLoadingState title="Cargando tu rutina actual..." />;
  }

  if (routineQuery.isError) {
    return (
      <ClientErrorState
        title="No fue posible cargar tu rutina"
        description="Revisa tu conexión o vuelve a intentar en unos segundos."
      />
    );
  }

  const { data, meta } = routineQuery.data;
  const activeRoutine = data.workspace.activeRoutine;
  const trainingContextHelper = buildTrainingContextHelper(data.workspace.trainingProfile);
  const dayCount = getRoutineDayCount(data.workspace.activeDetails);
  const exerciseCount = getRoutineExerciseCount(data.workspace.activeDetails);
  const primaryGoalLabel = getPrimaryGoalLabel(activeRoutine?.primary_goal);

  return (
    <div className="space-y-6 pb-4">
      <div className="space-y-4">
        <ClientSyncStatus meta={meta} />

        <section className="relative overflow-hidden rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] shadow-sm">
          <div className="flex flex-col gap-6 p-5 md:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  <IconSparkles className="h-3.5 w-3.5" />
                  Rutina lista para entrenar
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black tracking-tight md:text-4xl">Tu rutina</h2>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                    Revisa tu plan activo, ubica rápidamente los días clave y úsalo como guía antes de cada sesión.
                  </p>
                </div>
              </div>

              {activeRoutine ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant={getStatusBadgeVariant(activeRoutine.status)} className="h-8 px-3">
                    {getStatusLabel(activeRoutine.status)}
                  </Badge>
                  <Badge variant="secondary" className="h-8 px-3">
                    {dayCount} días
                  </Badge>
                  <Badge variant="secondary" className="h-8 px-3">
                    {exerciseCount} ejercicios
                  </Badge>
                </div>
              ) : null}
            </div>

            {activeRoutine ? (
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <ClientMetricCard
                  icon={<IconBarbell className="h-4 w-4" />}
                  label="Rutina"
                  value={activeRoutine.name}
                  helper="Versión aprobada por tu entrenador"
                />
                <ClientMetricCard
                  icon={<IconTargetArrow className="h-4 w-4" />}
                  label="Objetivo"
                  value={primaryGoalLabel || "Sin objetivo definido"}
                  helper={trainingContextHelper || "Aún falta más contexto de entrenamiento."}
                />
                <ClientMetricCard
                  icon={<IconChecklist className="h-4 w-4" />}
                  label="Carga total"
                  value={`${exerciseCount} ejercicios`}
                  helper={`${dayCount} días planificados esta semana`}
                />
                <ClientMetricCard
                  icon={<IconClockHour4 className="h-4 w-4" />}
                  label="Perfil"
                  value={getStatusLabel(data.workspace.trainingProfileStatus)}
                  helper={trainingContextHelper || "Perfil pendiente de completar."}
                />
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-background/35 px-4 py-4 text-sm leading-relaxed text-muted-foreground">
                Tu entrenador aún no ha publicado una versión lista para entrenar. Cuando esté aprobada la verás aquí con el detalle completo por día.
              </div>
            )}
          </div>
        </section>
      </div>

      {!activeRoutine ? (
        <Card className="overflow-hidden border-border/70 bg-card/70 shadow-sm">
          <CardHeader className="space-y-3 border-b border-border/60 pb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <IconBarbell className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold tracking-tight">Aún no hay una rutina activa</CardTitle>
              <p className="text-sm text-muted-foreground">
                Tu entrenador todavía no ha publicado una versión lista para entrenar.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-5 text-sm text-muted-foreground">
            <p>
              Cuando la rutina esté lista aparecerá aquí automáticamente junto con el detalle de días, bloques y ejercicios.
            </p>
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 px-4 py-3 text-xs leading-relaxed">
              Mientras tanto, mantén tus datos y objetivos al día para que tu plan salga más ajustado a tu progreso.
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-[26px] border border-border/70 bg-card/55 px-4 py-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Resumen del plan</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {primaryGoalLabel || "Plan general"} • {dayCount} días • {exerciseCount} ejercicios
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary">
                <IconMoodSmile className="h-3.5 w-3.5" />
                Sigue el orden por día y bloque para aprovechar mejor la sesión.
              </div>
            </div>
          </div>

          <RoutineViewer
            title="Rutina aprobada"
            routine={activeRoutine}
            details={data.workspace.activeDetails}
            editable={false}
            editors={{}}
            onEditorChange={() => undefined}
            onSave={async () => undefined}
            onReplace={() => undefined}
            busyDetailId={null}
          />
        </>
      )}
    </div>
  );
}

function ClientMetricCard({
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
