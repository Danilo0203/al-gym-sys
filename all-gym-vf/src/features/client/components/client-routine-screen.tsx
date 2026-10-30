"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IconBarbell } from "@tabler/icons-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ClientRoutinePlan } from "@/features/client/components/client-routine-plan";
import { ClientErrorState, ClientLoadingState } from "@/features/client/components/client-resource-state";
import { ClientSyncStatus } from "@/features/client/components/client-sync-status";
import { useClientRoutine, useRoutineProgress } from "@/features/client/hooks/use-client-api";

export function ClientRoutineScreen() {
  const routineQuery = useClientRoutine();
  const progressMutation = useRoutineProgress();
  const [resetTarget, setResetTarget] = useState<{ routineId: string; day: number } | null>(null);

  if (routineQuery.isPending) return <ClientLoadingState title="Cargando tu rutina actual..." />;
  if (!routineQuery.data) {
    return <ClientErrorState title="No fue posible cargar tu rutina" description="Revisa tu conexión o vuelve a intentar en unos segundos." />;
  }

  const { data, meta } = routineQuery.data;
  const activeRoutine = data.workspace.activeRoutine;
  const completedDetailIds = data.progress?.routineId === activeRoutine?.id ? data.progress?.completedDetailIds ?? [] : [];

  return (
    <div className="space-y-5 pb-2">
      {!activeRoutine ? (
        <section className="space-y-3 rounded-2xl border bg-card p-6">
          <IconBarbell className="size-8 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-semibold">Aún no hay una rutina activa</h2>
          <p className="text-sm text-muted-foreground">Cuando tu entrenador publique tu rutina, aquí encontrarás los ejercicios y sus demostraciones.</p>
        </section>
      ) : (
        <ClientRoutinePlan
          key={activeRoutine.id}
          routine={activeRoutine}
          details={data.workspace.activeDetails}
          completedDetailIds={completedDetailIds}
          isSaving={progressMutation.isPending}
          pendingDetailId={progressMutation.variables && "detailId" in progressMutation.variables ? progressMutation.variables.detailId : null}
          error={progressMutation.isError ? progressMutation.error.message : undefined}
          onToggle={async (detailId, completed) => {
            await progressMutation.mutateAsync({ routineId: activeRoutine.id, detailId, completed }, {
              onError: (error) => toast.error(error.message),
            });
          }}
          onResetDay={(day) => { progressMutation.reset(); setResetTarget({ routineId: activeRoutine.id, day }); }}
        />
      )}
      {routineQuery.isError ? <p role="alert" className="text-sm text-muted-foreground">No se pudo actualizar la rutina. Se muestra la última información recibida.</p> : null}
      <ClientSyncStatus meta={meta} />

      <AlertDialog open={resetTarget !== null} onOpenChange={(open) => { if (!open && !progressMutation.isPending) setResetTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reiniciar día {resetTarget?.day}?</AlertDialogTitle>
            <AlertDialogDescription>Los ejercicios de este día volverán a estar pendientes para que puedas repetir la sesión. El avance de los demás días se conservará.</AlertDialogDescription>
          </AlertDialogHeader>
          {progressMutation.isError ? <p role="alert" className="text-sm text-destructive">{progressMutation.error.message}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={progressMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={progressMutation.isPending} onClick={(event) => {
              event.preventDefault();
              if (resetTarget === null) return;
              progressMutation.mutate(resetTarget, { onSuccess: () => setResetTarget(null) });
            }}>{progressMutation.isPending ? "Reiniciando..." : "Reiniciar día"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
