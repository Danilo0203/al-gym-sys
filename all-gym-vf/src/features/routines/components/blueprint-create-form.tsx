"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconArrowLeft, IconBarbell, IconBolt, IconClockHour4, IconDeviceFloppy, IconFlame, IconGripVertical, IconPlus, IconTargetArrow, IconTrash } from "@tabler/icons-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIMARY_GOAL_OPTIONS } from "@/lib/training/options";
import type { RoutineBlockType } from "@/lib/training/types";
import { cn } from "@/lib/utils";
import { ExerciseSelectorDialog } from "@/features/exercises/components/exercise-selector-dialog";
import {
  createRoutineBlueprintFromScratch,
  type CreateBlueprintInput,
} from "@/features/routines/actions/blueprint-actions";

const BLOCK_TYPE_OPTIONS: Array<{ label: string; value: RoutineBlockType }> = [
  { label: "Calentamiento", value: "warmup" },
  { label: "Fuerza", value: "strength" },
  { label: "Accesorio", value: "accessory" },
  { label: "Cardio", value: "cardio" },
  { label: "Movilidad", value: "mobility" },
];

let nextTempId = 0;
function tempId(): string {
  nextTempId += 1;
  return `temp_${nextTempId}`;
}

interface LocalExercise {
  tempId: string;
  exercise_id: number | null;
  exercise_name: string | null;
  exercise_image_url: string | null;
  block_type: RoutineBlockType;
  sets: string;
  reps: string;
  rest_seconds: string;
  duration_minutes: string;
  target_rir: string;
}

interface LocalDay {
  tempId: string;
  exercises: LocalExercise[];
}

function emptyExercise(): LocalExercise {
  return {
    tempId: tempId(),
    exercise_id: null,
    exercise_name: null,
    exercise_image_url: null,
    block_type: "strength",
    sets: "",
    reps: "",
    rest_seconds: "",
    duration_minutes: "",
    target_rir: "",
  };
}

function emptyDay(): LocalDay {
  return {
    tempId: tempId(),
    exercises: [emptyExercise()],
  };
}

type GoalMode = "preset" | "custom";

export function BlueprintCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [primaryGoalMode, setPrimaryGoalMode] = useState<GoalMode>("preset");
  const [primaryGoalValue, setPrimaryGoalValue] = useState("");
  const [primaryGoalCustom, setPrimaryGoalCustom] = useState("");
  const [secondaryGoalMode, setSecondaryGoalMode] = useState<GoalMode | "empty">("empty");
  const [secondaryGoalValue, setSecondaryGoalValue] = useState("");
  const [secondaryGoalCustom, setSecondaryGoalCustom] = useState("");
  const [days, setDays] = useState<LocalDay[]>([emptyDay()]);
  const [isSaving, setIsSaving] = useState(false);

  // Exercise selector dialog state
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState<{ dayTempId: string; exerciseTempId: string } | null>(null);

  const openSelector = useCallback((dayTempId: string, exerciseTempId: string) => {
    setSelectorTarget({ dayTempId, exerciseTempId });
    setSelectorOpen(true);
  }, []);

  const handleExerciseSelect = useCallback(
    (exercise: { id: number; name: string; imageUrl: string | null }) => {
      if (!selectorTarget) return;
      setDays((prev) =>
        prev.map((day) => {
          if (day.tempId !== selectorTarget.dayTempId) return day;
          return {
            ...day,
            exercises: day.exercises.map((ex) => {
              if (ex.tempId !== selectorTarget.exerciseTempId) return ex;
              return {
                ...ex,
                exercise_id: exercise.id,
                exercise_name: exercise.name,
                exercise_image_url: exercise.imageUrl,
              };
            }),
          };
        }),
      );
      setSelectorTarget(null);
    },
    [selectorTarget],
  );

  const addDay = useCallback(() => {
    setDays((prev) => [...prev, emptyDay()]);
  }, []);

  const removeDay = useCallback((dayTempId: string) => {
    setDays((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((d) => d.tempId !== dayTempId);
    });
  }, []);

  const addExercise = useCallback((dayTempId: string) => {
    setDays((prev) =>
      prev.map((day) => {
        if (day.tempId !== dayTempId) return day;
        return { ...day, exercises: [...day.exercises, emptyExercise()] };
      }),
    );
  }, []);

  const removeExercise = useCallback((dayTempId: string, exerciseTempId: string) => {
    setDays((prev) =>
      prev.map((day) => {
        if (day.tempId !== dayTempId) return day;
        if (day.exercises.length <= 1) return day;
        return { ...day, exercises: day.exercises.filter((ex) => ex.tempId !== exerciseTempId) };
      }),
    );
  }, []);

  const updateExercise = useCallback(
    (dayTempId: string, exerciseTempId: string, patch: Partial<LocalExercise>) => {
      setDays((prev) =>
        prev.map((day) => {
          if (day.tempId !== dayTempId) return day;
          return {
            ...day,
            exercises: day.exercises.map((ex) => {
              if (ex.tempId !== exerciseTempId) return ex;
              return { ...ex, ...patch };
            }),
          };
        }),
      );
    },
    [],
  );

  const dayIds = useMemo(() => days.map((d) => d.tempId), [days]);
  const totalExercises = useMemo(() => days.reduce((s, d) => s + d.exercises.length, 0), [days]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDayDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDays((prev) => {
      const oldIndex = prev.findIndex((d) => d.tempId === active.id);
      const newIndex = prev.findIndex((d) => d.tempId === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleExerciseDragEnd = useCallback((dayTempId: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDays((prev) =>
      prev.map((day) => {
        if (day.tempId !== dayTempId) return day;
        const oldIndex = day.exercises.findIndex((ex) => ex.tempId === active.id);
        const newIndex = day.exercises.findIndex((ex) => ex.tempId === over.id);
        if (oldIndex === -1 || newIndex === -1) return day;
        return { ...day, exercises: arrayMove(day.exercises, oldIndex, newIndex) };
      }),
    );
  }, []);

  const getPrimaryGoal = useCallback(() => {
    if (primaryGoalMode === "custom") return primaryGoalCustom.trim();
    return primaryGoalValue;
  }, [primaryGoalMode, primaryGoalValue, primaryGoalCustom]);

  const getSecondaryGoal = useCallback(() => {
    if (secondaryGoalMode === "empty") return null;
    if (secondaryGoalMode === "custom") return secondaryGoalCustom.trim() || null;
    return secondaryGoalValue || null;
  }, [secondaryGoalMode, secondaryGoalValue, secondaryGoalCustom]);

  const validate = useCallback((): string | null => {
    if (!title.trim()) return "El título es obligatorio.";
    const pg = getPrimaryGoal();
    if (!pg) return "El objetivo principal es obligatorio.";
    if (primaryGoalMode === "custom" && !primaryGoalCustom.trim()) return "Debes escribir el objetivo principal personalizado.";
    if (secondaryGoalMode === "custom" && !secondaryGoalCustom.trim()) return "Debes escribir el objetivo secundario personalizado.";
    if (days.length === 0) return "Debe tener al menos un día.";
    if (totalExercises === 0) return "Debe tener al menos un ejercicio.";
    for (const day of days) {
      for (const ex of day.exercises) {
        if (!ex.exercise_id) return "Todos los ejercicios deben tener un ejercicio seleccionado.";
      }
    }
    return null;
  }, [title, days, primaryGoalMode, primaryGoalCustom, secondaryGoalMode, secondaryGoalCustom, totalExercises, getPrimaryGoal]);

  const handleSave = useCallback(async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setIsSaving(true);
    try {
      const input: CreateBlueprintInput = {
        title: title.trim(),
        primary_goal: getPrimaryGoal(),
        secondary_goal: getSecondaryGoal(),
        days: days.map((day) => ({
          exercises: day.exercises.map((ex) => ({
            exercise_id: ex.exercise_id!,
            block_type: ex.block_type,
            sets: ex.sets.trim() ? Number(ex.sets.trim()) || null : null,
            reps: ex.reps.trim() || null,
            rest_seconds: ex.rest_seconds.trim() ? Number(ex.rest_seconds.trim()) || null : null,
            duration_minutes: ex.duration_minutes.trim() ? Number(ex.duration_minutes.trim()) || null : null,
            target_rir: ex.target_rir.trim() ? Number(ex.target_rir.trim()) || null : null,
          })),
        })),
      };

      const result = await createRoutineBlueprintFromScratch(input);
      if (result.success) {
        toast.success("Plantilla creada correctamente.");
        router.push(`/panel/rutinas/${result.blueprintId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear la plantilla.");
    } finally {
      setIsSaving(false);
    }
  }, [title, days, validate, getPrimaryGoal, getSecondaryGoal, router]);

  return (
    <div className="space-y-6">
      {/* Metadata section */}
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-5">
          <CardTitle className="text-xl font-semibold tracking-tight">Información de la plantilla</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="space-y-2">
            <Label htmlFor="title">Título <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre de la plantilla"
              className="rounded-xl"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <Label>Objetivo principal <span className="text-destructive">*</span></Label>
              <Select
                value={primaryGoalMode === "custom" ? "custom" : (primaryGoalValue || undefined)}
                onValueChange={(v) => {
                  if (v === "custom") {
                    setPrimaryGoalMode("custom");
                  } else {
                    setPrimaryGoalMode("preset");
                    setPrimaryGoalValue(v);
                  }
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccionar objetivo..." />
                </SelectTrigger>
                <SelectContent>
                  {PRIMARY_GOAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                  <SelectItem value="custom">Otro (personalizado)</SelectItem>
                </SelectContent>
              </Select>
              {primaryGoalMode === "custom" && (
                <Input
                  value={primaryGoalCustom}
                  onChange={(e) => setPrimaryGoalCustom(e.target.value)}
                  placeholder="Escribe el objetivo principal..."
                  className="rounded-xl"
                />
              )}
            </div>

            <div className="space-y-3">
              <Label>Objetivo secundario</Label>
              <Select
                value={secondaryGoalMode === "empty" ? "empty" : secondaryGoalMode === "custom" ? "custom" : (secondaryGoalValue || undefined)}
                onValueChange={(v) => {
                  if (v === "empty") {
                    setSecondaryGoalMode("empty");
                    setSecondaryGoalValue("");
                    setSecondaryGoalCustom("");
                  } else if (v === "custom") {
                    setSecondaryGoalMode("custom");
                  } else {
                    setSecondaryGoalMode("preset");
                    setSecondaryGoalValue(v);
                  }
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Sin objetivo secundario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empty">Sin objetivo secundario</SelectItem>
                  {PRIMARY_GOAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                  <SelectItem value="custom">Otro (personalizado)</SelectItem>
                </SelectContent>
              </Select>
              {secondaryGoalMode === "custom" && (
                <Input
                  value={secondaryGoalCustom}
                  onChange={(e) => setSecondaryGoalCustom(e.target.value)}
                  placeholder="Escribe el objetivo secundario..."
                  className="rounded-xl"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Days builder */}
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-xl font-semibold tracking-tight">Constructor de rutina</CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{days.length} día{days.length !== 1 ? "s" : ""}</span>
                <span>·</span>
                <span>{totalExercises} ejercicio{totalExercises !== 1 ? "s" : ""}</span>
              </div>
              <Button size="sm" onClick={addDay} variant="outline">
                <IconPlus className="size-4" />
                Agregar día
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
            <SortableContext items={dayIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {days.map((day, dayIndex) => (
                  <SortableDay
                    key={day.tempId}
                    day={day}
                    dayIndex={dayIndex}
                    isOnlyDay={days.length === 1}
                    onRemove={() => removeDay(day.tempId)}
                    onAddExercise={() => addExercise(day.tempId)}
                    onRemoveExercise={(exId) => removeExercise(day.tempId, exId)}
                    onUpdateExercise={(exId, patch) => updateExercise(day.tempId, exId, patch)}
                    onSelectExercise={(exId) => openSelector(day.tempId, exId)}
                    onExerciseDragEnd={handleExerciseDragEnd(day.tempId)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {days.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Agrega al menos un día para empezar a construir la plantilla.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <Button variant="outline" onClick={() => router.back()}>
          <IconArrowLeft className="size-4" />
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          <IconDeviceFloppy className="size-4" />
          {isSaving ? "Guardando..." : "Guardar plantilla"}
        </Button>
      </div>

      <ExerciseSelectorDialog
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        onSelect={handleExerciseSelect}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SortableDay                                                                */
/* -------------------------------------------------------------------------- */

function SortableDay({
  day,
  dayIndex,
  isOnlyDay,
  onRemove,
  onAddExercise,
  onRemoveExercise,
  onUpdateExercise,
  onSelectExercise,
  onExerciseDragEnd,
}: {
  day: LocalDay;
  dayIndex: number;
  isOnlyDay: boolean;
  onRemove: () => void;
  onAddExercise: () => void;
  onRemoveExercise: (tempId: string) => void;
  onUpdateExercise: (tempId: string, patch: Partial<LocalExercise>) => void;
  onSelectExercise: (tempId: string) => void;
  onExerciseDragEnd: (event: DragEndEvent) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: day.tempId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const exerciseIds = useMemo(() => day.exercises.map((ex) => ex.tempId), [day.exercises]);

  return (
    <div ref={setNodeRef} style={style}>
      <Accordion type="multiple" defaultValue={[`day-${day.tempId}`]} className="space-y-0">
        <AccordionItem
          value={`day-${day.tempId}`}
          className="overflow-hidden rounded-2xl border border-border/70 bg-background/40 px-0 shadow-sm"
        >
          <AccordionTrigger className="px-5 py-5 hover:bg-muted/20 hover:no-underline">
            <div className="flex flex-1 flex-wrap items-center justify-between gap-3 pr-2 text-left">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground"
                  {...attributes}
                  {...listeners}
                >
                  <IconGripVertical className="size-5" />
                </button>
                <div className="space-y-1">
                  <h4 className="text-base font-semibold uppercase tracking-[0.18em] text-foreground/90">
                    Día {dayIndex + 1}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {day.exercises.length} ejercicio{day.exercises.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{day.exercises.length} ejercicios</Badge>
                {!isOnlyDay ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                    }}
                  >
                    <IconTrash className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <DndContext
              sensors={useSensors(
                useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
                useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
              )}
              collisionDetection={closestCenter}
              onDragEnd={onExerciseDragEnd}
            >
              <SortableContext items={exerciseIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {day.exercises.map((ex, exIndex) => (
                    <SortableExercise
                      key={ex.tempId}
                      exercise={ex}
                      exIndex={exIndex}
                      isOnlyExercise={day.exercises.length === 1}
                      onUpdate={(patch) => onUpdateExercise(ex.tempId, patch)}
                      onRemove={() => onRemoveExercise(ex.tempId)}
                      onSelectExercise={() => onSelectExercise(ex.tempId)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={onAddExercise}>
                <IconPlus className="size-4" />
                Agregar ejercicio
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SortableExercise                                                           */
/* -------------------------------------------------------------------------- */

function SortableExercise({
  exercise,
  exIndex,
  isOnlyExercise,
  onUpdate,
  onRemove,
  onSelectExercise,
}: {
  exercise: LocalExercise;
  exIndex: number;
  isOnlyExercise: boolean;
  onUpdate: (patch: Partial<LocalExercise>) => void;
  onRemove: () => void;
  onSelectExercise: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.tempId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const blockTone = getBlockTone(exercise.block_type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-[28px] border border-border/70 bg-card/75 shadow-sm transition-all duration-200",
        !isDragging && "hover:-translate-y-0.5 hover:border-border hover:bg-card/90 hover:shadow-lg",
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent", blockTone.glow)} />
      <div className={cn("absolute bottom-0 left-0 top-0 w-1", blockTone.rail)} />

      <div className="p-4 md:p-5 space-y-4">
        {/* Header with grip, block type, order */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground"
              {...attributes}
              {...listeners}
            >
              <IconGripVertical className="size-5" />
            </button>
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              #{exIndex + 1}
            </span>
            <Select
              value={exercise.block_type}
              onValueChange={(v) => onUpdate({ block_type: v as RoutineBlockType })}
            >
              <SelectTrigger className={cn("h-7 rounded-full px-3 py-0 text-xs gap-1 w-auto", blockTone.badge)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {!isOnlyExercise ? (
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={onRemove}
              >
                <IconTrash className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {/* Exercise selector + name */}
        <div className="flex items-center gap-4">
          {exercise.exercise_image_url ? (
            <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl border bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={exercise.exercise_image_url}
                alt={exercise.exercise_name || "Ejercicio"}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl border bg-muted/20">
              <IconBarbell className="size-6 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {exercise.exercise_name ? (
              <p className="text-xl font-bold leading-tight">{exercise.exercise_name}</p>
            ) : (
              <p className="text-xl font-bold leading-tight text-muted-foreground">Seleccionar ejercicio</p>
            )}
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onSelectExercise}>
              {exercise.exercise_name ? "Cambiar ejercicio" : "Seleccionar ejercicio"}
            </Button>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          <ExerciseField icon={<IconBarbell className="size-3.5" />} label="Series" value={exercise.sets} onChange={(v) => onUpdate({ sets: v })} inputMode="numeric" />
          <ExerciseField icon={<IconTargetArrow className="size-3.5" />} label="Reps" value={exercise.reps} onChange={(v) => onUpdate({ reps: v })} />
          <ExerciseField icon={<IconClockHour4 className="size-3.5" />} label="Descanso (s)" value={exercise.rest_seconds} onChange={(v) => onUpdate({ rest_seconds: v })} inputMode="numeric" />
          <ExerciseField icon={<IconBolt className="size-3.5" />} label="Duración (min)" value={exercise.duration_minutes} onChange={(v) => onUpdate({ duration_minutes: v })} inputMode="numeric" />
          <ExerciseField icon={<IconFlame className="size-3.5" />} label="RIR" value={exercise.target_rir} onChange={(v) => onUpdate({ target_rir: v })} inputMode="decimal" />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function ExerciseField({
  icon,
  label,
  value,
  onChange,
  inputMode,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">{label}</span>
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        className="h-9 rounded-xl bg-background/80 text-sm"
        placeholder="-"
      />
    </div>
  );
}

function getBlockTone(blockType: RoutineBlockType) {
  switch (blockType) {
    case "warmup":
      return {
        rail: "bg-amber-400",
        glow: "from-amber-500/18 via-amber-500/6",
        badge: "border-amber-500/45 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100",
      };
    case "strength":
      return {
        rail: "bg-red-500",
        glow: "from-red-500/18 via-red-500/6",
        badge: "border-red-500/45 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-100",
      };
    case "accessory":
      return {
        rail: "bg-sky-400",
        glow: "from-sky-500/18 via-sky-500/6",
        badge: "border-sky-500/45 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-100",
      };
    case "cardio":
      return {
        rail: "bg-emerald-400",
        glow: "from-emerald-500/18 via-emerald-500/6",
        badge: "border-emerald-500/45 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100",
      };
    case "mobility":
      return {
        rail: "bg-violet-400",
        glow: "from-violet-500/18 via-violet-500/6",
        badge: "border-violet-500/45 bg-violet-50 text-violet-800 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-100",
      };
    default:
      return {
        rail: "bg-primary",
        glow: "from-primary/16 via-primary/5",
        badge: "border-primary/35 bg-primary/10 text-primary",
      };
  }
}
