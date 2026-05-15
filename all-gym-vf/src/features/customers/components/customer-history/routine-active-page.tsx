"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconArrowLeft, IconBarbell, IconChecklist, IconClockHour4, IconSparkles } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { updateRoutineDetail } from "@/features/customers/actions/customer-routine-actions";
import type { CustomerRoutineWorkspace } from "@/lib/training/types";
import {
  buildEditorState,
  getRoutineDayCount,
  getRoutineExerciseCount,
  getStatusBadgeVariant,
  getStatusLabel,
  RoutineViewer,
  type DetailEditorState,
} from "./tabs/routine-workspace-shared";

interface RoutineActivePageProps {
  customerId: string;
  customerName: string;
  workspace: CustomerRoutineWorkspace;
}

function toNullableInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableFloat(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function RoutineActivePage({ customerId, customerName, workspace }: RoutineActivePageProps) {
  const router = useRouter();
  const [editors, setEditors] = useState<Record<number, DetailEditorState>>({});
  const [busyDetailId, setBusyDetailId] = useState<number | null>(null);
  const backHref = `/panel/clientes/${customerId}/history#routine`;
  const draftHref = `/panel/clientes/${customerId}/rutina/borrador`;
  const activeRoutine = workspace.activeRoutine;
  const activeDetails = workspace.activeDetails;

  useEffect(() => {
    const nextEditors: Record<number, DetailEditorState> = {};
    for (const detail of activeDetails) {
      nextEditors[detail.id] = buildEditorState(detail);
    }
    setEditors(nextEditors);
  }, [activeDetails]);

  const handleEditorChange = (detailId: number, patch: Partial<DetailEditorState>) => {
    const detail = activeDetails.find((currentDetail) => currentDetail.id === detailId);
    if (!detail) return;

    setEditors((current) => ({
      ...current,
      [detailId]: {
        ...(current[detailId] || buildEditorState(detail)),
        ...patch,
      },
    }));
  };

  const handleSaveDetail = async (detailId: number) => {
    const editor = editors[detailId];
    if (!editor) return;

    try {
      setBusyDetailId(detailId);
      await updateRoutineDetail(detailId, {
        sets: toNullableInt(editor.sets),
        reps: editor.reps.trim() || null,
        rest_seconds: toNullableInt(editor.rest_seconds),
        duration_minutes: toNullableInt(editor.duration_minutes),
        target_rir: toNullableFloat(editor.target_rir),
        notes: editor.notes.trim() || null,
      });
      toast.success("Ajuste guardado en la rutina activa.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el ajuste.");
    } finally {
      setBusyDetailId(null);
    }
  };

  if (!activeRoutine) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Button asChild variant="ghost" className="h-auto px-0 text-muted-foreground hover:bg-transparent">
              <Link href={backHref}>
                <IconArrowLeft className="h-4 w-4" />
                Volver al perfil
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Rutina activa</h1>
              <p className="text-sm text-muted-foreground">{customerName}</p>
            </div>
          </div>
        </div>

        <Card className="border-border/70">
          <CardContent className="space-y-3 p-8 text-center">
            <p className="text-lg font-semibold">Todavía no hay una rutina activa</p>
            <p className="text-sm text-muted-foreground">
              Aprueba un borrador o genera una nueva propuesta para poder editar aquí la versión vigente.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link href={backHref}>Volver a rutina</Link>
              </Button>
              {workspace.draftRoutine ? (
                <Button asChild>
                  <Link href={draftHref}>Abrir borrador</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-4 pb-8 md:p-6">
          <section className="overflow-hidden rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] shadow-sm">
            <div className="flex flex-col gap-6 p-5 md:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <Button asChild variant="ghost" className="h-auto px-0 text-muted-foreground hover:bg-transparent">
                    <Link href={backHref}>
                      <IconArrowLeft className="h-4 w-4" />
                      Volver al perfil
                    </Link>
                  </Button>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                          <IconSparkles className="mr-1 h-3.5 w-3.5" />
                        Edición activa
                        </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-3xl font-black tracking-tight md:text-4xl">Rutina activa</h1>
                        <Badge variant={getStatusBadgeVariant(activeRoutine.status)}>{getStatusLabel(activeRoutine.status)}</Badge>
                      </div>
                      <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
                        {customerName} · {activeRoutine.name}
                      </p>
                      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        Puedes editar la rutina publicada cuando necesites ajustar prescripción, descansos, duración o notas sin generar un borrador nuevo.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{getRoutineDayCount(activeDetails)} días</Badge>
                  <Badge variant="secondary">{getRoutineExerciseCount(activeDetails)} ejercicios</Badge>
                  <Badge variant="outline">Editable</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <HeroMetric icon={<IconChecklist className="h-4 w-4" />} label="Estado" value={getStatusLabel(activeRoutine.status)} />
                <HeroMetric icon={<IconBarbell className="h-4 w-4" />} label="Ejercicios" value={`${getRoutineExerciseCount(activeDetails)}`} />
                <HeroMetric icon={<IconClockHour4 className="h-4 w-4" />} label="Frecuencia" value={`${getRoutineDayCount(activeDetails)} días`} />
                <HeroMetric icon={<IconSparkles className="h-4 w-4" />} label="Objetivo" value={activeRoutine.primary_goal || "Sin definir"} />
              </div>
            </div>
          </section>

          <RoutineViewer
            title="Rutina activa"
            routine={activeRoutine}
            details={activeDetails}
            editable
            canReplace={false}
            editors={editors}
            onEditorChange={handleEditorChange}
            onSave={handleSaveDetail}
            onReplace={() => undefined}
            busyDetailId={busyDetailId}
          />
        </div>
      </div>

      <div className="border-t bg-background/95 px-4 py-4 backdrop-blur md:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Puedes corregir series, repeticiones, descansos, duración, RIR y notas directamente sobre la rutina activa.
            </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={backHref}>Volver al perfil</Link>
            </Button>
            {workspace.draftRoutine ? (
              <Button asChild>
                <Link href={draftHref}>Abrir borrador nuevo</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="text-sm font-semibold leading-tight md:text-base">{value}</p>
    </div>
  );
}
