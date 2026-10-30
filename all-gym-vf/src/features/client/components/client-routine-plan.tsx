"use client";

import { useId, useRef, useState } from "react";
import { IconCheck, IconChevronLeft, IconChevronRight, IconExternalLink, IconLoader2, IconPlayerPlay, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientExerciseMedia } from "@/features/client/components/client-exercise-media";
import { getExercisePrescription, getInitialRoutineDay, getRoutineDays, ROUTINE_BLOCK_LABELS } from "@/features/client/lib/routine-view";
import { isExerciseMediaStoredLocally } from "@/lib/training/exercise-media";
import { PRIMARY_GOAL_OPTIONS } from "@/lib/training/options";
import { getDayProgress } from "@/lib/training/routine-progress";
import type { RoutineDetailRecord, RoutineRecord } from "@/lib/training/types";
import { cn } from "@/lib/utils";

interface ClientRoutinePlanProps {
  routine: RoutineRecord;
  details: RoutineDetailRecord[];
  completedDetailIds: number[];
  isSaving: boolean;
  pendingDetailId: number | null;
  error?: string;
  onToggle: (detailId: number, completed: boolean) => Promise<void>;
  onResetDay: (day: number) => void;
}

export function ClientRoutinePlan({ routine, details, completedDetailIds, isSaving, pendingDetailId, error, onToggle, onResetDay }: ClientRoutinePlanProps) {
  const days = getRoutineDays(details);
  const completedIds = new Set(completedDetailIds);
  const [selectedDay, setSelectedDay] = useState(() => getInitialRoutineDay(days, completedIds));
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const dialogOpener = useRef<HTMLButtonElement | null>(null);
  const operationPending = useRef(false);
  const panelId = useId();
  const selected = days.find(({ day }) => day === selectedDay) ?? days[0];
  const exercises = selected?.exercises ?? [];
  const progress = getDayProgress(exercises, completedIds);
  const activeIndex = exercises.findIndex(({ id }) => id === selectedExerciseId);
  const activeExercise = exercises[activeIndex];
  const firstPending = exercises.find(({ id }) => !completedIds.has(id));
  const completedDays = days.filter(({ exercises: dayExercises }) => getDayProgress(dayExercises, completedIds).isComplete).length;
  const primaryGoal = PRIMARY_GOAL_OPTIONS.find(({ value }) => value === routine.primary_goal)?.label ?? routine.primary_goal;

  function openExercise(id: number, opener: HTMLButtonElement) {
    dialogOpener.current = opener;
    setSelectedExerciseId(id);
  }

  async function toggleExercise(detail: RoutineDetailRecord, advance = false) {
    if (operationPending.current || isSaving) return;
    operationPending.current = true;
    const completed = !completedIds.has(detail.id);
    try {
      await onToggle(detail.id, completed);
      // Advance only after the server confirms the change.
      if (advance && completed) {
        const next = exercises.slice(activeIndex + 1).find(({ id }) => !completedIds.has(id));
        if (next) setSelectedExerciseId((current) => current === detail.id ? next.id : current);
      }
    } catch {
      // The screen and dialog show the mutation error, preserving the selected exercise.
    } finally {
      operationPending.current = false;
    }
  }

  return (
    <section className="space-y-4" aria-label="Tu rutina">
      <header className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Tu plan{days.length ? ` · ${days.length} días` : ""}</p>
        <h2 className="text-2xl font-bold tracking-tight break-words sm:text-3xl">{routine.name}</h2>
        {primaryGoal ? <p className="text-sm text-muted-foreground">{primaryGoal}</p> : null}
      </header>
      {selected ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(4rem,1fr))] gap-2" role="group" aria-label="Días de tu rutina">
            {days.map(({ day, exercises: dayExercises }) => {
              const dayProgress = getDayProgress(dayExercises, completedIds);
              return (
                <button key={day} type="button" aria-pressed={selected.day === day} aria-controls={panelId}
                  onClick={() => { setSelectedDay(day); setSelectedExerciseId(null); }}
                  className={cn("flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    selected.day === day ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground hover:bg-muted")}>
                  <span className="text-sm font-semibold">Día {day}</span>
                  <span className={cn("flex items-center gap-1 text-[11px]", selected.day !== day && "text-muted-foreground")}>
                    {dayProgress.isComplete ? <><IconCheck className="size-3" aria-hidden="true" />Hecho</> : dayProgress.completed ? "En curso" : "Pendiente"}
                  </span>
                </button>
              );
            })}
          </div>
          <div id={panelId} className="space-y-3" aria-label={`Ejercicios del día ${selected.day}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="text-lg font-semibold">Día {selected.day}</h3><p className="text-xs text-muted-foreground">{exercises.length} ejercicios asignados</p></div>
              <Button type="button" className="min-h-11 rounded-xl" onClick={(event) => openExercise((firstPending ?? exercises[0]).id, event.currentTarget)}>
                <IconPlayerPlay className="size-4" aria-hidden="true" />
                {progress.isComplete ? "Repasar" : progress.completed ? "Continuar" : "Empezar"}
              </Button>
            </div>
            <DayProgress completed={progress.completed} total={progress.total} />
            <ol className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
              {exercises.map((detail, index) => {
                const completed = completedIds.has(detail.id);
                const title = detail.exercise_name_snapshot || "Ejercicio por definir";
                return (
                  <li key={detail.id} className={cn("flex items-center gap-1 px-2 sm:px-3", completed && "bg-primary/[0.03]")}>
                    <button type="button" onClick={(event) => openExercise(detail.id, event.currentTarget)} aria-label={`Ver ejercicio ${index + 1}: ${title}`}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-3 pr-1 pl-1 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring">
                      <ClientExerciseMedia src={detail.exercise_image_url} name={title} thumbnail />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="block text-[11px] text-muted-foreground">{index + 1}. {ROUTINE_BLOCK_LABELS[detail.block_type]}</span>
                        <span className="block text-sm leading-snug font-semibold break-words">{title}</span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">{getExercisePrescription(detail)}</span>
                      </span>
                    </button>
                    <Button type="button" variant="ghost" size="icon" disabled={isSaving} aria-pressed={completed}
                      aria-label={`${completed ? "Desmarcar" : "Completar"} ${title}`}
                      className="size-11 shrink-0 rounded-full" onClick={() => void toggleExercise(detail)}>
                      <span className={cn("flex size-7 items-center justify-center rounded-full border", completed ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
                        {isSaving && pendingDetailId === detail.id ? <IconLoader2 className="size-4 animate-spin" /> : completed ? <IconCheck className="size-4" /> : null}
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ol>
            {error ? <SaveError message={error} /> : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Tu avance se guarda al marcar cada ejercicio.</p>
              <Button type="button" variant="ghost" size="sm" className="min-h-11 text-muted-foreground" disabled={isSaving || !progress.completed} onClick={() => onResetDay(selected.day)}>
                <IconRefresh className="size-4" aria-hidden="true" />Reiniciar día
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{completedDays} de {days.length} días completados en este plan</p>
        </>
      ) : <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">Tu entrenador aún no ha añadido ejercicios a esta rutina.</p>}

      <Dialog open={Boolean(activeExercise)} onOpenChange={(open) => { if (!open) setSelectedExerciseId(null); }}>
        {activeExercise ? (
          <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl"
            onCloseAutoFocus={(event) => { event.preventDefault(); dialogOpener.current?.focus(); }}>
            <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left">
              <DialogDescription>Día {selected?.day} · Ejercicio {activeIndex + 1} de {exercises.length}</DialogDescription>
              <DialogTitle className="text-xl leading-snug break-words">{activeExercise.exercise_name_snapshot || "Ejercicio por definir"}</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
              <ClientExerciseMedia key={activeExercise.id} src={activeExercise.exercise_image_url} name={activeExercise.exercise_name_snapshot || "Ejercicio"} />
              {isExerciseMediaStoredLocally(activeExercise.exercise_image_url) ? (
                <a href={activeExercise.exercise_image_url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
                  <IconExternalLink className="size-4" aria-hidden="true" />Ampliar demostración
                </a>
              ) : null}
              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-3">
                {activeExercise.sets != null ? <PrescriptionValue label="Series" value={activeExercise.sets} /> : null}
                {activeExercise.reps ? <PrescriptionValue label="Repeticiones" value={activeExercise.reps} /> : null}
                {activeExercise.rest_seconds != null ? <PrescriptionValue label="Descanso" value={`${activeExercise.rest_seconds} s`} /> : null}
                {activeExercise.duration_minutes != null ? <PrescriptionValue label="Duración" value={`${activeExercise.duration_minutes} min`} /> : null}
                {activeExercise.target_rir != null ? <PrescriptionValue label="Repeticiones en reserva" value={activeExercise.target_rir} /> : null}
              </dl>
              {activeExercise.notes ? <div className="space-y-1"><h4 className="text-sm font-semibold">Indicaciones del entrenador</h4><p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{activeExercise.notes}</p></div> : null}
              <DayProgress completed={progress.completed} total={progress.total} />
              {error ? <SaveError message={error} /> : null}
            </div>
            <div className="shrink-0 space-y-2 border-t bg-background px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] sm:px-5">
              <Button type="button" disabled={isSaving} className="min-h-12 w-full rounded-xl whitespace-normal" variant={completedIds.has(activeExercise.id) ? "secondary" : "default"} onClick={() => void toggleExercise(activeExercise, true)}>
                {isSaving ? <IconLoader2 className="size-4 animate-spin" /> : <IconCheck className="size-4" />}
                {isSaving ? "Guardando…" : completedIds.has(activeExercise.id) ? "Completado · Desmarcar" : "Marcar ejercicio como hecho"}
              </Button>
              <div className="flex items-center justify-between gap-2">
                <Button type="button" variant="ghost" className="min-h-11 px-2" disabled={activeIndex === 0 || isSaving} onClick={() => setSelectedExerciseId(exercises[activeIndex - 1].id)}><IconChevronLeft className="size-4" />Anterior</Button>
                <Button type="button" variant="ghost" className="min-h-11 px-2" disabled={isSaving} onClick={() => activeIndex < exercises.length - 1 ? setSelectedExerciseId(exercises[activeIndex + 1].id) : setSelectedExerciseId(null)}>{activeIndex < exercises.length - 1 ? "Siguiente" : "Volver a la lista"}<IconChevronRight className="size-4" /></Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}

function DayProgress({ completed, total }: { completed: number; total: number }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center justify-between gap-2 text-xs" role="status"><span>{completed === total && total > 0 ? "¡Día completado!" : "Avance del día"}</span><span className="font-medium tabular-nums">{completed} de {total}</span></p>
      <div role="progressbar" aria-label="Ejercicios completados" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={total} className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${total ? completed / total * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function PrescriptionValue({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold break-words tabular-nums">{value}</dd></div>;
}

function SaveError({ message }: { message: string }) {
  return <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">{message}</p>;
}
