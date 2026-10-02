"use client";
/* eslint-disable @next/next/no-img-element */

import { useDeferredValue, useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  Loader2,
  PencilLine,
  Plus,
  Search,
  ImagePlus,
  Dumbbell,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import type { ExerciseCatalogItem } from "@/lib/training/types";
import { isExerciseMediaStoredLocally } from "@/lib/training/exercise-media";
import {
  attachExerciseImage,
  createExerciseCatalogItem,
  updateExerciseCatalogPreferences,
  updateExerciseCatalogItem,
} from "@/features/exercises/actions/exercise-actions";

interface ExerciseCatalogManagerProps {
  exercises: ExerciseCatalogItem[];
  totalCount: number;
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXERCISE_TYPE_OPTIONS = [
  { value: "strength", label: "Fuerza" },
  { value: "cardio", label: "Cardio" },
  { value: "mobility", label: "Movilidad" },
  { value: "stretching", label: "Estiramiento" },
  { value: "balance", label: "Equilibrio" },
] as const;
const BODY_PART_OPTIONS = [
  { value: "chest", label: "Pecho" }, { value: "back", label: "Espalda" },
  { value: "shoulders", label: "Hombros" }, { value: "upper arms", label: "Brazos" },
  { value: "waist", label: "Abdomen" }, { value: "upper legs", label: "Piernas" },
  { value: "lower legs", label: "Pantorrillas" }, { value: "cardio", label: "Cardio" },
  { value: "full body", label: "Cuerpo completo" },
] as const;
const TARGET_MUSCLE_OPTIONS = [
  { value: "pectorals", label: "Pectorales" }, { value: "lats", label: "Dorsales" },
  { value: "mid back", label: "Espalda media" }, { value: "delts", label: "Deltoides" },
  { value: "biceps", label: "Bíceps" }, { value: "triceps", label: "Tríceps" },
  { value: "quadriceps", label: "Cuádriceps" }, { value: "hamstrings", label: "Isquiotibiales" },
  { value: "glutes", label: "Glúteos" }, { value: "calves", label: "Pantorrillas" },
  { value: "core", label: "Abdomen" },
] as const;
const EQUIPMENT_OPTIONS = [
  { value: "body weight", label: "Peso corporal" }, { value: "dumbbell", label: "Mancuerna" },
  { value: "barbell", label: "Barra" }, { value: "kettlebell", label: "Pesa rusa" },
  { value: "cable", label: "Polea" }, { value: "machine", label: "Máquina" },
  { value: "resistance band", label: "Banda" }, { value: "treadmill", label: "Caminadora" },
  { value: "stationary bike", label: "Bicicleta fija" }, { value: "rowing machine", label: "Remo" },
] as const;
const metadataSelectClassName = "border-input bg-background h-9 w-full rounded-md border px-3 text-sm";

const createExerciseFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Ingresa un nombre de al menos 2 caracteres.")
      .max(120, "El nombre no puede superar los 120 caracteres."),
    image: z.custom<File | undefined>((value) => value === undefined || value instanceof File, {
      message: "Selecciona una imagen válida.",
    }),
    exerciseType: z.enum(["strength", "cardio", "mobility", "stretching", "balance"]),
    bodyPart: z.string(),
    targetMuscle: z.string(),
    equipment: z.string(),
    instructions: z.string().max(2000),
  })
  .superRefine((value, ctx) => {
    const instructionLines = value.instructions.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (instructionLines.length > 20 || instructionLines.some((line) => line.length > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["instructions"],
        message: "Escribe hasta 20 pasos de 100 caracteres cada uno.",
      });
    }
    if (value.image instanceof File) {
      if (!ACCEPTED_IMAGE_TYPES.has(value.image.type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["image"],
          message: "La imagen debe ser JPG, PNG, WEBP o GIF.",
        });
      }

      if (value.image.size > MAX_IMAGE_SIZE_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["image"],
          message: "La imagen no puede superar los 5 MB.",
        });
      }
    }

  });

type CreateExerciseFormValues = z.infer<typeof createExerciseFormSchema>;
type ManualExerciseMetadata = Pick<CreateExerciseFormValues,
  "exerciseType" | "bodyPart" | "targetMuscle" | "equipment" | "instructions">;
type ExerciseCatalogFilter = "all" | "favorites" | "hidden";

export function ExerciseCatalogManager({ exercises, totalCount }: ExerciseCatalogManagerProps) {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const canCreate = Boolean(currentUser?.isOwner || currentUser?.permissions?.includes("exercises.create"));
  const canUpdate = Boolean(currentUser?.isOwner || currentUser?.permissions?.includes("exercises.update"));
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [catalogFilter, setCatalogFilter] = useState<ExerciseCatalogFilter>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogKey, setCreateDialogKey] = useState(0);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<ExerciseCatalogItem | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingImage, setEditingImage] = useState<File | null>(null);
  const [editingMetadata, setEditingMetadata] = useState<ManualExerciseMetadata>({
    exerciseType: "strength", bodyPart: "", targetMuscle: "", equipment: "", instructions: "",
  });
  const [editingMetadataTouched, setEditingMetadataTouched] = useState<Partial<Record<keyof ManualExerciseMetadata, boolean>>>({});
  const [isCreating, startCreateTransition] = useTransition();
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isAttachingImage, startAttachImageTransition] = useTransition();
  const [pendingPreference, setPendingPreference] = useState<{
    exerciseId: number;
    action: "favorite" | "preview";
  } | null>(null);
  const [isUpdatingPreference, startPreferenceTransition] = useTransition();
  const createForm = useForm<CreateExerciseFormValues>({
    resolver: zodResolver(createExerciseFormSchema),
    defaultValues: {
      name: "",
      image: undefined,
      exerciseType: "strength",
      bodyPart: "",
      targetMuscle: "",
      equipment: "",
      instructions: "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const shouldValidateCreateForm = createForm.formState.submitCount > 0;

  useEffect(() => {
    return () => {
      if (selectedImagePreview) {
        URL.revokeObjectURL(selectedImagePreview);
      }
    };
  }, [selectedImagePreview]);

  const normalizedSearchTerm = deferredSearchTerm.trim().toLowerCase();
  const visibleExercisesCount = exercises.filter((exercise) => !exercise.is_preview_hidden).length;
  const favoriteExercisesCount = exercises.filter((exercise) => exercise.is_favorite && !exercise.is_preview_hidden).length;
  const hiddenExercisesCount = exercises.filter((exercise) => exercise.is_preview_hidden).length;
  const filteredExercises = exercises
    .filter((exercise) => {
      if (!normalizedSearchTerm) return true;

      const searchableText = [
        exercise.display_name_es,
        exercise.display_name,
        exercise.name,
        exercise.provider,
        ...exercise.body_parts,
        ...exercise.target_muscles,
        ...exercise.equipments,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearchTerm);
    })
    .filter((exercise) => matchesExerciseCatalogFilter(exercise, catalogFilter))
    .slice()
    .sort((left, right) => {
      if (left.is_favorite !== right.is_favorite) {
        return left.is_favorite ? -1 : 1;
      }

      return getExerciseDisplayName(left).localeCompare(getExerciseDisplayName(right), "es", {
        sensitivity: "base",
      });
    });

  const handleCreateDialogChange = (open: boolean) => {
    setIsCreateDialogOpen(open);

    if (!open) {
      setSelectedImagePreview((currentPreview) => {
        if (currentPreview) {
          URL.revokeObjectURL(currentPreview);
        }

        return null;
      });
      createForm.reset({
        name: "",
        image: undefined,
      });
      setCreateDialogKey((current) => current + 1);
    }
  };

  const handleCreateImageChange = (file: File | null, shouldValidate = shouldValidateCreateForm) => {
    createForm.setValue("image", file ?? undefined, {
      shouldDirty: true,
      shouldValidate,
    });
    createForm.clearErrors("image");

    setSelectedImagePreview((currentPreview) => {
      if (currentPreview) {
        URL.revokeObjectURL(currentPreview);
      }

      return file ? URL.createObjectURL(file) : null;
    });
  };

  const openEditDialog = (exercise: ExerciseCatalogItem) => {
    setEditingExercise(exercise);
    setEditingName(getExerciseDisplayName(exercise));
    setEditingImage(null);
    setEditingMetadata({
      exerciseType: EXERCISE_TYPE_OPTIONS.some((option) => option.value === exercise.exercise_type)
        ? exercise.exercise_type as ManualExerciseMetadata["exerciseType"] : "strength",
      bodyPart: exercise.body_parts[0] ?? "",
      targetMuscle: exercise.target_muscles[0] ?? "",
      equipment: exercise.equipments[0] ?? "",
      instructions: exercise.instructions.join("\n"),
    });
    setEditingMetadataTouched({});
  };

  const touchEditingMetadata = (key: keyof ManualExerciseMetadata) => {
    setEditingMetadataTouched((current) => ({ ...current, [key]: true }));
  };

  const handleCreateExercise = createForm.handleSubmit((values) => {
    const trimmedName = values.name.trim();

    startCreateTransition(async () => {
      const formData = new FormData();
      formData.set("name", trimmedName);
      formData.set("exerciseType", values.exerciseType);
      formData.set("bodyPart", values.bodyPart);
      formData.set("targetMuscle", values.targetMuscle);
      formData.set("equipment", values.equipment);
      formData.set("instructions", values.instructions);
      if (values.image instanceof File) {
        formData.set("image", values.image);
      }

      const result = await createExerciseCatalogItem(formData);

      if (!result.success) {
        toast.error(result.error || "No se pudo crear el ejercicio.");
        return;
      }

      toast.success(result.message || "Ejercicio creado correctamente.");
      handleCreateDialogChange(false);
      router.refresh();
    });
  });

  const handleUpdateExercise = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingExercise) {
      return;
    }

    startUpdateTransition(async () => {
      const result = await updateExerciseCatalogItem({
        exerciseId: editingExercise.id,
        displayName: editingName,
        metadata: editingExercise.provider === "custom_local" ? {
          ...(editingMetadataTouched.exerciseType ? { exerciseType: editingMetadata.exerciseType } : {}),
          ...(editingMetadataTouched.bodyPart ? { bodyPart: editingMetadata.bodyPart } : {}),
          ...(editingMetadataTouched.targetMuscle ? { targetMuscle: editingMetadata.targetMuscle } : {}),
          ...(editingMetadataTouched.equipment ? { equipment: editingMetadata.equipment } : {}),
          ...(editingMetadataTouched.instructions ? { instructions: editingMetadata.instructions } : {}),
        } : undefined,
      });

      if (!result.success) {
        toast.error(result.error || "No se pudo actualizar el ejercicio.");
        return;
      }

      toast.success(result.message || "Ejercicio actualizado correctamente.");
      setEditingExercise(null);
      setEditingName("");
      setEditingImage(null);
      setEditingMetadataTouched({});
      router.refresh();
    });
  };

  const handleAttachImage = () => {
    if (!editingExercise || !editingImage) return;
    const formData = new FormData();
    formData.set("image", editingImage);
    startAttachImageTransition(async () => {
      const result = await attachExerciseImage(editingExercise.id, formData);
      if (!result.success) {
        toast.error(result.error || "No se pudo guardar la imagen local.");
        return;
      }
      toast.success(result.message || "Imagen local guardada.");
      setEditingExercise(null);
      setEditingName("");
      setEditingImage(null);
      router.refresh();
    });
  };

  const handleToggleFavorite = (exercise: ExerciseCatalogItem) => {
    const nextValue = !exercise.is_favorite;
    setPendingPreference({ exerciseId: exercise.id, action: "favorite" });

    startPreferenceTransition(async () => {
      const result = await updateExerciseCatalogPreferences({
        exerciseId: exercise.id,
        isFavorite: nextValue,
      });

      setPendingPreference(null);

      if (!result.success) {
        toast.error(result.error || "No se pudo actualizar el favorito.");
        return;
      }

      toast.success(nextValue ? "Ejercicio agregado a favoritos." : "Ejercicio eliminado de favoritos.");
      router.refresh();
    });
  };

  const handleTogglePreviewVisibility = (exercise: ExerciseCatalogItem) => {
    const nextValue = !exercise.is_preview_hidden;
    setPendingPreference({ exerciseId: exercise.id, action: "preview" });

    startPreferenceTransition(async () => {
      const result = await updateExerciseCatalogPreferences({
        exerciseId: exercise.id,
        isPreviewHidden: nextValue,
      });

      setPendingPreference(null);

      if (!result.success) {
        toast.error(result.error || "No se pudo actualizar la visibilidad del preview.");
        return;
      }

      toast.success(nextValue ? "Preview oculta en el catálogo." : "Preview visible nuevamente.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Estado del Catálogo Local</CardTitle>
          <CardDescription>
            Actualmente hay <strong>{totalCount}</strong> ejercicios importados o creados en la base local.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-end">
          {canCreate && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus />
            Nuevo ejercicio
          </Button>
          )}
        </CardFooter>
      </Card>

      <Card className="gap-4">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Catálogo local</CardTitle>
                <CardDescription>
                  Administra los ejercicios guardados localmente, marca favoritos y oculta previews que no quieras ver.
                </CardDescription>
              </div>
              <div className="w-full max-w-md">
                <Label htmlFor="exercise-search" className="sr-only">
                  Buscar ejercicios
                </Label>
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    id="exercise-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar por nombre, equipo o grupo muscular..."
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CatalogFilterButton
                active={catalogFilter === "all"}
                count={visibleExercisesCount}
                label="Todos"
                onClick={() => setCatalogFilter("all")}
              />
              <CatalogFilterButton
                active={catalogFilter === "favorites"}
                count={favoriteExercisesCount}
                label="Favoritos"
                onClick={() => setCatalogFilter("favorites")}
              />
              <CatalogFilterButton
                active={catalogFilter === "hidden"}
                count={hiddenExercisesCount}
                label="Ocultos"
                onClick={() => setCatalogFilter("hidden")}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <span>{getCatalogCountLabel(filteredExercises.length, catalogFilter)}</span>
            <span>
              {catalogFilter === "all" ? "Vista: todos" : `Vista: ${getCatalogFilterLabel(catalogFilter)}`}
              {normalizedSearchTerm ? ` · Busqueda: ${deferredSearchTerm}` : ""}
            </span>
          </div>

          {filteredExercises.length === 0 ? (
            <div className="border-border bg-muted/20 flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
              <Dumbbell className="text-muted-foreground mb-4 size-8" />
              <p className="font-medium">No encontramos ejercicios para esa vista.</p>
              <p className="text-muted-foreground mt-2 max-w-md text-sm">
                Ajusta la busqueda, cambia el filtro o agrega un ejercicio nuevo al catálogo local.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredExercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  showHiddenPreview={catalogFilter === "hidden"}
                  canUpdate={canUpdate}
                  onEdit={() => openEditDialog(exercise)}
                  onToggleFavorite={() => handleToggleFavorite(exercise)}
                  onTogglePreviewVisibility={() => handleTogglePreviewVisibility(exercise)}
                  isTogglingFavorite={
                    isUpdatingPreference &&
                    pendingPreference?.exerciseId === exercise.id &&
                    pendingPreference.action === "favorite"
                  }
                  isTogglingPreview={
                    isUpdatingPreference &&
                    pendingPreference?.exerciseId === exercise.id &&
                    pendingPreference.action === "preview"
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogChange}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-border border-b px-6 pt-6 pb-4">
            <DialogTitle>Nuevo ejercicio</DialogTitle>
            <DialogDescription>
              Crea un ejercicio ahora y añade una imagen de tu computadora cuando la tengas. Todo se guardará en el equipo local.
            </DialogDescription>
          </DialogHeader>
          <form
              key={createDialogKey}
              onSubmit={handleCreateExercise}
              className="flex min-h-0 flex-1 flex-col"
              encType="multipart/form-data"
              noValidate
            >
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <Controller
                  control={createForm.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Nombre</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        placeholder="Ej. Sentadilla frontal con mancuerna"
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <div className="space-y-4">
                    <p className="text-muted-foreground text-sm">
                      Estos datos ayudan a seleccionar el ejercicio al crear rutinas locales. Puedes dejar los campos opcionales vacíos.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Controller control={createForm.control} name="exerciseType" render={({ field }) => (
                        <Field>
                          <FieldLabel htmlFor="new-exercise-type">Tipo</FieldLabel>
                          <select {...field} id="new-exercise-type" className={metadataSelectClassName}>
                            {EXERCISE_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </Field>
                      )} />
                      <Controller control={createForm.control} name="bodyPart" render={({ field }) => (
                        <Field>
                          <FieldLabel htmlFor="new-exercise-body-part">Zona corporal</FieldLabel>
                          <select {...field} id="new-exercise-body-part" className={metadataSelectClassName}>
                            <option value="">Sin especificar</option>
                            {BODY_PART_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </Field>
                      )} />
                      <Controller control={createForm.control} name="targetMuscle" render={({ field }) => (
                        <Field>
                          <FieldLabel htmlFor="new-exercise-target-muscle">Músculo principal</FieldLabel>
                          <select {...field} id="new-exercise-target-muscle" className={metadataSelectClassName}>
                            <option value="">Sin especificar</option>
                            {TARGET_MUSCLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </Field>
                      )} />
                      <Controller control={createForm.control} name="equipment" render={({ field }) => (
                        <Field>
                          <FieldLabel htmlFor="new-exercise-equipment">Equipo</FieldLabel>
                          <select {...field} id="new-exercise-equipment" className={metadataSelectClassName}>
                            <option value="">Sin especificar</option>
                            {EQUIPMENT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </Field>
                      )} />
                    </div>
                    <Controller control={createForm.control} name="instructions" render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="new-exercise-instructions">Instrucciones opcionales</FieldLabel>
                        <Textarea {...field} id="new-exercise-instructions" rows={3}
                          placeholder="Un paso por línea" aria-invalid={fieldState.invalid} />
                        <FieldDescription>Hasta 20 pasos de 100 caracteres cada uno.</FieldDescription>
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )} />
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)]">
                      <Controller
                        control={createForm.control}
                        name="image"
                        render={({ fieldState }) => (
                          <Field data-invalid={fieldState.invalid} className="space-y-3">
                            <FieldLabel htmlFor="new-exercise-image">Imagen opcional</FieldLabel>
                            <Input
                              id="new-exercise-image"
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              aria-invalid={fieldState.invalid}
                              onChange={(event) => handleCreateImageChange(event.target.files?.[0] ?? null)}
                            />
                            <FieldDescription>
                              Puedes crear el ejercicio sin imagen y añadir un archivo local después. Formatos: JPG, PNG, WEBP o GIF; máximo 5 MB.
                            </FieldDescription>
                            <FieldError errors={[fieldState.error]} />
                          </Field>
                        )}
                      />

                      <ExerciseCreatePreview
                        title="Vista previa"
                        src={selectedImagePreview}
                        emptyLabel="La vista previa aparecerá aquí"
                        helper="Si seleccionas una imagen, se guardará junto al ejercicio."
                      />
                    </div>
                </div>
              </div>

              <DialogFooter className="border-border border-t px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCreateDialogChange(false)}
                  disabled={isCreating}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
                  Guardar ejercicio
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingExercise)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingExercise(null);
            setEditingName("");
            setEditingImage(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar ejercicio</DialogTitle>
            <DialogDescription>Actualiza el nombre, los detalles para rutinas o añade una imagen de tu computadora.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateExercise} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="edit-exercise-name">Nombre visible</Label>
              <Input
                id="edit-exercise-name"
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                placeholder="Nombre del ejercicio"
                required
              />
            </div>

            {editingExercise?.provider === "custom_local" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-exercise-type">Tipo</Label>
                  <select id="edit-exercise-type" className={metadataSelectClassName} value={editingMetadata.exerciseType}
                    onChange={(event) => {
                      setEditingMetadata((current) => ({ ...current, exerciseType: event.target.value as ManualExerciseMetadata["exerciseType"] }));
                      touchEditingMetadata("exerciseType");
                    }}>
                    {EXERCISE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-exercise-body-part">Zona corporal</Label>
                  <select id="edit-exercise-body-part" className={metadataSelectClassName} value={editingMetadata.bodyPart}
                    onChange={(event) => {
                      setEditingMetadata((current) => ({ ...current, bodyPart: event.target.value }));
                      touchEditingMetadata("bodyPart");
                    }}>
                    <option value="">Sin especificar</option>
                    {editingMetadata.bodyPart && !BODY_PART_OPTIONS.some((option) => option.value === editingMetadata.bodyPart) ? (
                      <option value={editingMetadata.bodyPart}>{editingMetadata.bodyPart}</option>
                    ) : null}
                    {BODY_PART_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-exercise-target-muscle">Músculo principal</Label>
                  <select id="edit-exercise-target-muscle" className={metadataSelectClassName} value={editingMetadata.targetMuscle}
                    onChange={(event) => {
                      setEditingMetadata((current) => ({ ...current, targetMuscle: event.target.value }));
                      touchEditingMetadata("targetMuscle");
                    }}>
                    <option value="">Sin especificar</option>
                    {editingMetadata.targetMuscle && !TARGET_MUSCLE_OPTIONS.some((option) => option.value === editingMetadata.targetMuscle) ? (
                      <option value={editingMetadata.targetMuscle}>{editingMetadata.targetMuscle}</option>
                    ) : null}
                    {TARGET_MUSCLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-exercise-equipment">Equipo</Label>
                  <select id="edit-exercise-equipment" className={metadataSelectClassName} value={editingMetadata.equipment}
                    onChange={(event) => {
                      setEditingMetadata((current) => ({ ...current, equipment: event.target.value }));
                      touchEditingMetadata("equipment");
                    }}>
                    <option value="">Sin especificar</option>
                    {editingMetadata.equipment && !EQUIPMENT_OPTIONS.some((option) => option.value === editingMetadata.equipment) ? (
                      <option value={editingMetadata.equipment}>{editingMetadata.equipment}</option>
                    ) : null}
                    {EQUIPMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-exercise-instructions">Instrucciones</Label>
                  <Textarea id="edit-exercise-instructions" rows={3} value={editingMetadata.instructions}
                    onChange={(event) => {
                      setEditingMetadata((current) => ({ ...current, instructions: event.target.value }));
                      touchEditingMetadata("instructions");
                    }} placeholder="Un paso por línea" />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="edit-exercise-image">Imagen local</Label>
              <Input
                id="edit-exercise-image"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => setEditingImage(event.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" onClick={handleAttachImage} disabled={!editingImage || isAttachingImage || isUpdating}>
                {isAttachingImage ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                Guardar imagen
              </Button>
              <p className="text-muted-foreground text-xs">El nombre y la imagen se guardan por separado.</p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingExercise(null);
                  setEditingName("");
                  setEditingImage(null);
                }}
                disabled={isUpdating || isAttachingImage}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isUpdating || isAttachingImage}>
                {isUpdating ? <Loader2 className="animate-spin" /> : <PencilLine />}
                Guardar cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExerciseCreatePreview({
  title,
  src,
  emptyLabel,
  helper,
}: {
  title: string;
  src: string | null;
  emptyLabel: string;
  helper?: string;
}) {
  return (
    <div className="space-y-3">
      <Label>{title}</Label>
      <div className="bg-muted/30 border-border overflow-hidden rounded-xl border">
        <ExerciseImage
          src={src}
          alt={title}
          className="h-56 w-full object-cover lg:h-[320px]"
          fallback={
            <div className="text-muted-foreground flex h-56 flex-col items-center justify-center gap-3 px-6 text-center lg:h-[320px]">
              <ImagePlus className="size-9" />
              <span className="max-w-xs text-sm">{emptyLabel}</span>
            </div>
          }
        />
      </div>
      {helper ? <p className="text-muted-foreground text-xs">{helper}</p> : null}
    </div>
  );
}

function ExerciseImage({
  src,
  alt,
  className,
  fallback,
  loading,
}: {
  src?: string | null;
  alt: string;
  className: string;
  fallback: ReactNode;
  loading?: "eager" | "lazy";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const normalizedSrc = typeof src === "string"
    && (src.startsWith("blob:") || isExerciseMediaStoredLocally(src)) ? src : null;
  const hasError = Boolean(normalizedSrc) && failedSrc === normalizedSrc;

  if (!normalizedSrc || hasError) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={normalizedSrc}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setFailedSrc(normalizedSrc)}
    />
  );
}

function ExerciseCard({
  exercise,
  showHiddenPreview,
  onEdit,
  onToggleFavorite,
  onTogglePreviewVisibility,
  isTogglingFavorite = false,
  isTogglingPreview = false,
  canUpdate = true,
}: {
  exercise: ExerciseCatalogItem;
  showHiddenPreview: boolean;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onTogglePreviewVisibility: () => void;
  isTogglingFavorite: boolean;
  isTogglingPreview: boolean;
  canUpdate?: boolean;
}) {
  const displayName = getExerciseDisplayName(exercise);
  const isStoredLocally = isExerciseStoredLocally(exercise);
  const providerLabel = getProviderLabel(exercise.provider, isStoredLocally);
  const tags = [...exercise.body_parts, ...exercise.target_muscles, ...exercise.equipments].filter(Boolean).slice(0, 3);
  const previewImageUrl = exercise.image_url ?? undefined;
  const canShowPreview = Boolean(previewImageUrl) && (!exercise.is_preview_hidden || showHiddenPreview);

  return (
    <Card className="overflow-hidden py-0">
      <div className="bg-muted/30 relative aspect-[4/3] overflow-hidden">
        {canShowPreview ? (
          <ExerciseImage
            src={previewImageUrl}
            alt={displayName}
            className="h-full w-full object-cover"
            loading="lazy"
            fallback={
              <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3">
                <ImagePlus className="size-8" />
                <span className="text-sm">Sin imagen</span>
              </div>
            }
          />
        ) : exercise.is_preview_hidden ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3">
            <EyeOff className="size-8" />
            <span className="text-sm">Preview oculta</span>
          </div>
        ) : (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3">
            <ImagePlus className="size-8" />
            <span className="text-sm">Sin imagen</span>
          </div>
        )}
      </div>

      <CardHeader className="gap-3 px-5 pt-5 pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="line-clamp-2 text-base">{displayName}</CardTitle>
            <CardDescription className="line-clamp-1">
              {exercise.slug ? `Slug: ${exercise.slug}` : "Ejercicio local"}
            </CardDescription>
          </div>
          <Badge variant={isStoredLocally ? "success" : "outline"}>{providerLabel}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5">
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={`${exercise.id}-${tag}`} variant="secondary" className="capitalize">
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Este ejercicio no tiene etiquetas adicionales todavía.</p>
        )}
      </CardContent>

      <CardFooter className="border-border flex items-center justify-between border-t px-5 py-4">
        <span className="text-muted-foreground text-xs">ID #{exercise.id}</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <TooltipIconButton
            label={exercise.is_favorite ? "Quitar de favoritos" : "Marcar como favorito"}
            onClick={onToggleFavorite}
            disabled={isTogglingFavorite}
            className={exercise.is_favorite ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20" : undefined}
          >
            {isTogglingFavorite ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Star className={exercise.is_favorite ? "fill-current" : undefined} />
            )}
          </TooltipIconButton>
          <TooltipIconButton
            label={exercise.is_preview_hidden ? "Mostrar preview" : "Ocultar preview"}
            onClick={onTogglePreviewVisibility}
            disabled={isTogglingPreview}
          >
            {isTogglingPreview ? <Loader2 className="animate-spin" /> : exercise.is_preview_hidden ? <Eye /> : <EyeOff />}
          </TooltipIconButton>
          {canUpdate && (
          <TooltipIconButton label="Editar nombre" onClick={onEdit}>
            <PencilLine />
          </TooltipIconButton>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

function TooltipIconButton({
  children,
  className,
  disabled = false,
  label,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={className}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function CatalogFilterButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant={active ? "default" : "outline"} size="sm" onClick={onClick} className="gap-2">
      {label}
      <span className="rounded-full bg-black/10 px-2 py-0.5 text-[11px] leading-none dark:bg-white/10">{count}</span>
    </Button>
  );
}

function getExerciseDisplayName(exercise: ExerciseCatalogItem) {
  return exercise.display_name_es || exercise.display_name || exercise.name;
}

function getCatalogFilterLabel(filter: ExerciseCatalogFilter) {
  if (filter === "favorites") return "favoritos";
  if (filter === "hidden") return "ocultos";
  return "todos";
}

function getCatalogCountLabel(count: number, filter: ExerciseCatalogFilter) {
  if (filter === "hidden") {
    return `${count} ejercicios ocultos`;
  }

  return `${count} ejercicios visibles`;
}

function matchesExerciseCatalogFilter(exercise: ExerciseCatalogItem, filter: ExerciseCatalogFilter) {
  if (filter === "favorites") return exercise.is_favorite && !exercise.is_preview_hidden;
  if (filter === "hidden") return exercise.is_preview_hidden;
  return !exercise.is_preview_hidden;
}

function getProviderLabel(provider: string | null, isStoredLocally = false) {
  if (isStoredLocally) return "Local";
  if (!provider) return "Local";
  if (provider === "custom_local" || provider === "local") return "Local";
  if (provider === "starter_pack") return "Inicial";
  if (provider === "exercisedb") return "ExerciseDB";
  return provider;
}

function isExerciseStoredLocally(exercise: ExerciseCatalogItem) {
  if (exercise.provider === "custom_local" || exercise.provider === "local") {
    return true;
  }

  return isExerciseMediaStoredLocally(exercise.image_url);
}
