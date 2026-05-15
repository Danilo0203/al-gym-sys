"use client";

import { useEffect, useState } from "react";
import {
  IconBarbell,
  IconBolt,
  IconClockHour4,
  IconDeviceFloppy,
  IconExternalLink,
  IconFlame,
  IconNotes,
  IconRefresh,
  IconTargetArrow,
} from "@tabler/icons-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PRIMARY_GOAL_OPTIONS } from "@/lib/training/options";
import { formatSessionDuration } from "@/lib/training/profile-defaults";
import type { RoutineDetailRecord, RoutineRecord, TrainingProfileRecord } from "@/lib/training/types";
import { cn } from "@/lib/utils";

export interface DetailEditorState {
  sets: string;
  reps: string;
  rest_seconds: string;
  duration_minutes: string;
  target_rir: string;
  notes: string;
}

export function getStatusBadgeVariant(status: RoutineRecord["status"] | "complete" | "pending") {
  switch (status) {
    case "active":
    case "complete":
      return "success";
    case "draft":
      return "warning";
    case "pending_profile":
    case "pending":
      return "secondary";
    case "archived":
      return "outline";
    default:
      return "secondary";
  }
}

export function getStatusLabel(status: RoutineRecord["status"] | "complete" | "pending") {
  switch (status) {
    case "active":
      return "Activa";
    case "draft":
      return "Borrador";
    case "pending_profile":
      return "Pendiente de perfil";
    case "archived":
      return "Archivada";
    case "complete":
      return "Completo";
    case "pending":
      return "Pendiente";
    default:
      return status;
  }
}

function getBlockLabel(blockType: RoutineDetailRecord["block_type"]) {
  switch (blockType) {
    case "warmup":
      return "Calentamiento";
    case "strength":
      return "Fuerza";
    case "accessory":
      return "Accesorio";
    case "cardio":
      return "Cardio";
    case "mobility":
      return "Movilidad";
    default:
      return blockType;
  }
}

function hasUsableExerciseMedia(detail: RoutineDetailRecord) {
  return Boolean(detail.exercise_image_url);
}

function getBlockTone(blockType: RoutineDetailRecord["block_type"]) {
  switch (blockType) {
    case "warmup":
      return {
        rail: "bg-amber-400",
        glow: "from-amber-500/18 via-amber-500/6",
        badge:
          "border-amber-500/45 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100",
      };
    case "strength":
      return {
        rail: "bg-red-500",
        glow: "from-red-500/18 via-red-500/6",
        badge:
          "border-red-500/45 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-100",
      };
    case "accessory":
      return {
        rail: "bg-sky-400",
        glow: "from-sky-500/18 via-sky-500/6",
        badge:
          "border-sky-500/45 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-100",
      };
    case "cardio":
      return {
        rail: "bg-emerald-400",
        glow: "from-emerald-500/18 via-emerald-500/6",
        badge:
          "border-emerald-500/45 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100",
      };
    case "mobility":
      return {
        rail: "bg-violet-400",
        glow: "from-violet-500/18 via-violet-500/6",
        badge:
          "border-violet-500/45 bg-violet-50 text-violet-800 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-100",
      };
    default:
      return {
        rail: "bg-primary",
        glow: "from-primary/16 via-primary/5",
        badge: "border-primary/35 bg-primary/10 text-primary",
      };
  }
}

const WORKOUTX_API_KEY = "wx_6caf560e0d5e686d09bc51046f268764d0937fb5a4d51fa50f8526f0";

function normalizeMediaSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchExerciseMediaFallback(query: string): Promise<string | null> {
  const normalized = normalizeMediaSearchText(query);
  if (!normalized) return null;

  try {
    const url = new URL("https://api.workoutxapp.com/v1/exercises");
    url.searchParams.set("limit", "10");

    const response = await fetch(url.toString(), {
      headers: {
        "X-WorkoutX-Key": WORKOUTX_API_KEY,
      },
      cache: "force-cache",
    });

    if (!response.ok) return null;

    const exercises = (await response.json()) as Array<{
      id?: string;
      name?: string;
      gifUrl?: string;
    }>;

    const exactMatch = exercises.find(
      (e) => normalizeMediaSearchText(e.name || "") === normalized && e.gifUrl,
    );
    const partialMatch = exercises.find(
      (e) => normalizeMediaSearchText(e.name || "").includes(normalized) && e.gifUrl,
    );
    const anyWithGif = exercises.find((e) => e.gifUrl);

    return exactMatch?.gifUrl || partialMatch?.gifUrl || anyWithGif?.gifUrl || null;
  } catch {
    return null;
  }
}

function groupDetailsByDay(details: RoutineDetailRecord[]) {
  return details.reduce<Record<number, RoutineDetailRecord[]>>((accumulator, detail) => {
    accumulator[detail.day_of_week] = accumulator[detail.day_of_week] || [];
    accumulator[detail.day_of_week].push(detail);
    return accumulator;
  }, {});
}

export function getPrimaryGoalLabel(value: string | null | undefined) {
  if (!value) return null;

  const option = PRIMARY_GOAL_OPTIONS.find((item) => item.value === value);
  return option?.label ?? value;
}

export function buildEditorState(detail: RoutineDetailRecord): DetailEditorState {
  return {
    sets: detail.sets?.toString() || "",
    reps: detail.reps || "",
    rest_seconds: detail.rest_seconds?.toString() || "",
    duration_minutes: detail.duration_minutes?.toString() || "",
    target_rir: detail.target_rir?.toString() || "",
    notes: detail.notes || "",
  };
}

export function buildTrainingContextHelper(trainingProfile: TrainingProfileRecord | null) {
  return [
    trainingProfile?.primary_goal ? `Objetivo: ${getPrimaryGoalLabel(trainingProfile.primary_goal)}` : null,
    trainingProfile?.days_per_week ? `${trainingProfile.days_per_week} días/semana` : null,
    trainingProfile?.session_minutes ? `${formatSessionDuration(trainingProfile.session_minutes)} por sesión` : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

export function getRoutineDayCount(details: RoutineDetailRecord[]) {
  return new Set(details.map((detail) => detail.day_of_week)).size;
}

export function getRoutineExerciseCount(details: RoutineDetailRecord[]) {
  return details.length;
}

export function RoutineSummaryCard({ title, value, helper }: { title: string; value: string; helper?: string }) {
  return (
    <Card className="border-border/70 bg-card/70 shadow-sm backdrop-blur-sm">
      <CardContent className="space-y-3 p-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{title}</p>
        <div className="space-y-1.5">
          <p className="text-base font-semibold leading-tight text-foreground">{value}</p>
          {helper ? <p className="text-sm leading-relaxed text-muted-foreground">{helper}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function RoutineViewer({
  title,
  routine,
  details,
  editable,
  canReplace = editable,
  editors,
  onEditorChange,
  onSave,
  onReplace,
  busyDetailId,
}: {
  title: string;
  routine: RoutineRecord;
  details: RoutineDetailRecord[];
  editable: boolean;
  canReplace?: boolean;
  editors: Record<number, DetailEditorState>;
  onEditorChange: (detailId: number, patch: Partial<DetailEditorState>) => void;
  onSave: (detailId: number) => Promise<void>;
  onReplace: (detail: RoutineDetailRecord) => void;
  busyDetailId: number | null;
}) {
  const grouped = groupDetailsByDay(details);
  const days = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);
  const defaultOpenDays = days.length > 0 ? [`day-${days[0]}`] : [];
  const primaryGoalLabel = getPrimaryGoalLabel(routine.primary_goal);

  return (
    <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader className="space-y-4 border-b border-border/60 pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-xl font-semibold tracking-tight">{title}</CardTitle>
          <Badge variant={getStatusBadgeVariant(routine.status)}>{getStatusLabel(routine.status)}</Badge>
          {primaryGoalLabel ? <Badge variant="outline">{primaryGoalLabel}</Badge> : null}
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {editable
            ? "Puedes ajustar prescripción, descanso, notas y reemplazar ejercicios antes de aprobar."
            : "La rutina activa se muestra en solo lectura para mantener trazabilidad."}
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <IconBarbell className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.2em]">Ejercicios</span>
            </div>
            <p className="text-2xl font-semibold">{details.length}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <IconBolt className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.2em]">Bloques</span>
            </div>
            <p className="text-2xl font-semibold">{new Set(details.map((detail) => detail.block_type)).size}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <IconTargetArrow className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.2em]">Días</span>
            </div>
            <p className="text-2xl font-semibold">{days.length}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <IconFlame className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.2em]">Objetivo</span>
            </div>
            <p className="text-sm font-semibold leading-snug">{primaryGoalLabel || "Sin objetivo definido"}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {days.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Esta rutina todavía no tiene ejercicios asignados.
          </div>
        ) : null}

        {days.length > 0 ? (
          <Accordion type="multiple" defaultValue={defaultOpenDays} className="space-y-4">
            {days.map((day) => (
              <AccordionItem
                key={day}
                value={`day-${day}`}
                className="overflow-hidden rounded-2xl border border-border/70 bg-background/40 px-0 shadow-sm"
              >
                <AccordionTrigger className="px-5 py-5 hover:bg-muted/20 hover:no-underline">
                  <div className="flex flex-1 flex-wrap items-center justify-between gap-3 pr-2 text-left">
                    <div className="space-y-1">
                      <h4 className="text-base font-semibold uppercase tracking-[0.18em] text-foreground/90">
                        Día {day}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {editable
                          ? "Expande este día para revisar o ajustar ejercicios."
                          : "Expande este día para ver el detalle."}
                      </p>
                    </div>
                    <Badge variant="secondary">{grouped[day].length} ejercicios</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <div className="space-y-4">
                    {grouped[day].map((detail) => {
                      const editor = editors[detail.id] || buildEditorState(detail);
                      const isBusy = busyDetailId === detail.id;

                      return (
                        <ExerciseCard
                          key={detail.id}
                          detail={detail}
                          editable={editable}
                          canReplace={canReplace}
                          editor={editor}
                          isBusy={isBusy}
                          onEditorChange={onEditorChange}
                          onReplace={onReplace}
                          onSave={onSave}
                        />
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ExerciseCard({
  detail,
  editable,
  canReplace,
  editor,
  isBusy,
  onEditorChange,
  onReplace,
  onSave,
}: {
  detail: RoutineDetailRecord;
  editable: boolean;
  canReplace: boolean;
  editor: DetailEditorState;
  isBusy: boolean;
  onEditorChange: (detailId: number, patch: Partial<DetailEditorState>) => void;
  onReplace: (detail: RoutineDetailRecord) => void;
  onSave: (detailId: number) => Promise<void>;
}) {
  const tone = getBlockTone(detail.block_type);
  const demoHref = detail.exercise_video_url || detail.exercise_image_url || null;

  return (
    <article className="group relative overflow-hidden rounded-[28px] border border-border/70 bg-card/75 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-card/90 hover:shadow-lg hover:shadow-black/10">
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent", tone.glow)} />
      <div className={cn("absolute bottom-0 left-0 top-0 w-1", tone.rail)} />

      <div className="grid gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="border-b border-border/60 bg-background/35 p-4 lg:border-b-0 lg:border-r">
          <ExerciseMediaPreview detail={detail} />
        </div>

        <div className="min-w-0 space-y-5 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs", tone.badge)}>
                  {getBlockLabel(detail.block_type)}
                </Badge>
                {detail.exercise_order ? (
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs tabular-nums">
                    #{detail.exercise_order}
                  </Badge>
                ) : null}
                {hasUsableExerciseMedia(detail) ? (
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                    Demo visual
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black leading-tight tracking-tight text-foreground md:text-3xl">
                  {detail.exercise_name_snapshot || "Ejercicio por definir"}
                </h3>
                {detail.notes && !editable ? (
                  <div className="flex max-w-3xl items-start gap-2 rounded-2xl border border-border/60 bg-background/55 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
                    <IconNotes className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{detail.notes}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {demoHref ? (
                <Button asChild variant="secondary" size="sm" className="rounded-full px-4">
                  <a href={demoHref} target="_blank" rel="noreferrer">
                    <IconExternalLink className="h-4 w-4" />
                    Ver demo
                  </a>
                </Button>
              ) : null}
              {editable && canReplace ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReplace(detail)}
                  disabled={isBusy}
                  className="rounded-full px-4"
                >
                  <IconRefresh className="h-4 w-4" />
                  Reemplazar
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <ExerciseMetric icon={<IconBarbell className="h-4 w-4" />} label="Series" value={detail.sets?.toString() || "-"} />
            <ExerciseMetric icon={<IconTargetArrow className="h-4 w-4" />} label="Reps" value={detail.reps || "-"} />
            <ExerciseMetric icon={<IconClockHour4 className="h-4 w-4" />} label="Descanso" value={detail.rest_seconds ? `${detail.rest_seconds}s` : "-"} />
            <ExerciseMetric icon={<IconBolt className="h-4 w-4" />} label="Duración" value={detail.duration_minutes ? `${detail.duration_minutes} min` : "-"} />
            <ExerciseMetric icon={<IconFlame className="h-4 w-4" />} label="RIR" value={detail.target_rir?.toString() || "-"} />
          </div>

          {editable ? (
            <div className="rounded-3xl border border-border/70 bg-background/45 p-4 shadow-inner shadow-black/5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Ajustes de la rutina</p>
                  <p className="text-xs text-muted-foreground">
                    {canReplace
                      ? "Edita prescripción, descanso, notas o reemplaza ejercicios cuando haga falta."
                      : "Edita prescripción, descanso y notas directamente sobre la rutina activa."}
                  </p>
                </div>
                <Button size="sm" onClick={() => onSave(detail.id)} disabled={isBusy} className="rounded-full">
                  <IconDeviceFloppy className="h-4 w-4" />
                  {isBusy ? "Guardando..." : "Guardar"}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <ExerciseEditorField
                  label="Series"
                  value={editor.sets}
                  onChange={(value) => onEditorChange(detail.id, { sets: value })}
                  inputMode="numeric"
                />
                <ExerciseEditorField
                  label="Reps"
                  value={editor.reps}
                  onChange={(value) => onEditorChange(detail.id, { reps: value })}
                />
                <ExerciseEditorField
                  label="Descanso (seg)"
                  value={editor.rest_seconds}
                  onChange={(value) => onEditorChange(detail.id, { rest_seconds: value })}
                  inputMode="numeric"
                />
                <ExerciseEditorField
                  label="Duración (min)"
                  value={editor.duration_minutes}
                  onChange={(value) => onEditorChange(detail.id, { duration_minutes: value })}
                  inputMode="numeric"
                />
                <ExerciseEditorField
                  label="RIR objetivo"
                  value={editor.target_rir}
                  onChange={(value) => onEditorChange(detail.id, { target_rir: value })}
                  inputMode="decimal"
                />
              </div>

              <div className="mt-3 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Notas</label>
                <Textarea
                  value={editor.notes}
                  onChange={(event) => onEditorChange(detail.id, { notes: event.target.value })}
                  rows={3}
                  className="resize-none rounded-2xl bg-background/80"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ExerciseMediaPreview({ detail }: { detail: RoutineDetailRecord }) {
  const title = detail.exercise_name_snapshot || "Ejercicio por definir";
  const [hasMediaError, setHasMediaError] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(detail.exercise_image_url);
  const [hasAttemptedFallback, setHasAttemptedFallback] = useState(false);
  const [isResolvingFallback, setIsResolvingFallback] = useState(false);

  useEffect(() => {
    setMediaUrl(detail.exercise_image_url);
    setHasMediaError(false);
    setHasAttemptedFallback(false);
    setIsResolvingFallback(false);
  }, [detail.exercise_image_url, title]);

  useEffect(() => {
    if (mediaUrl || hasAttemptedFallback || isResolvingFallback || !title) {
      return;
    }

    let cancelled = false;

    const resolveFallback = async () => {
      try {
        setIsResolvingFallback(true);
        const fallbackUrl = await fetchExerciseMediaFallback(title);
        if (!cancelled && fallbackUrl) {
          setMediaUrl(fallbackUrl);
          setHasMediaError(false);
        }
      } finally {
        if (!cancelled) {
          setHasAttemptedFallback(true);
          setIsResolvingFallback(false);
        }
      }
    };

    void resolveFallback();

    return () => {
      cancelled = true;
    };
  }, [hasAttemptedFallback, isResolvingFallback, mediaUrl, title]);

  const canRenderMedia = Boolean(mediaUrl) && !hasMediaError;

  const handleMediaError = async () => {
    if (!hasAttemptedFallback && title) {
      setIsResolvingFallback(true);
      const fallbackUrl = await fetchExerciseMediaFallback(title);
      setHasAttemptedFallback(true);
      setIsResolvingFallback(false);

      if (fallbackUrl && fallbackUrl !== mediaUrl) {
        setMediaUrl(fallbackUrl);
        setHasMediaError(false);
        return;
      }
    }

    setHasMediaError(true);
  };

  return (
    <div className="w-full">
      {canRenderMedia ? (
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-muted/20 shadow-sm">
          <div className="relative aspect-[4/3] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_58%)]">
            <div className="absolute inset-3 rounded-2xl bg-background/35" />
            {/* GIF demos are rendered directly to preserve animation and avoid provider optimization issues. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl!}
              alt={`Demostración visual de ${title}`}
              loading="lazy"
              className="relative h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
              onError={() => void handleMediaError()}
            />
          </div>
        </div>
      ) : (
        <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-muted/10 px-4 py-3 text-center">
          <div className="mb-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
            <IconBarbell className="h-5 w-5" />
          </div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Sin imagen</p>
          <p className="line-clamp-3 text-sm font-semibold leading-snug text-foreground/90">{title}</p>
        </div>
      )}
    </div>
  );
}

function ExerciseMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const isEmpty = value === "-";

  return (
    <div className="rounded-2xl border border-border/60 bg-background/55 p-3 shadow-sm transition-colors group-hover:border-border/90">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className={cn("text-xl font-black leading-tight tabular-nums", isEmpty && "text-muted-foreground")}>{value}</p>
    </div>
  );
}

function ExerciseEditorField({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        className="rounded-2xl bg-background/80"
      />
    </div>
  );
}
