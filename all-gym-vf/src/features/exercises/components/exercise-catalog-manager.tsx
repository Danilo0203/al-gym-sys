"use client";
/* eslint-disable @next/next/no-img-element */

import { useDeferredValue, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  History,
  Loader2,
  PencilLine,
  Plus,
  Search,
  ImagePlus,
  Dumbbell,
  HardDriveDownload,
  Star,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import type { ExerciseCatalogItem, ProviderExerciseSummary } from "@/lib/training/types";
import {
  createExerciseCatalogItem,
  saveExerciseMediaToLocal,
  updateExerciseCatalogPreferences,
  updateExerciseCatalogItem,
} from "@/features/exercises/actions/exercise-actions";
import {
  importExerciseFromProvider,
  searchExerciseProvider,
} from "@/features/customers/actions/customer-routine-actions";

interface ExerciseCatalogManagerProps {
  exercises: ExerciseCatalogItem[];
  totalCount: number;
}

const PROVIDER_SEARCH_PAGE_SIZE = 12;
const PROVIDER_SEARCH_HISTORY_LIMIT = 5;
const PROVIDER_SEARCH_HISTORY_STORAGE_KEY = "exercise-provider-search-history";
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const createExerciseFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Ingresa un nombre de al menos 2 caracteres.")
      .max(120, "El nombre no puede superar los 120 caracteres."),
    source: z.enum(["upload", "provider"]),
    image: z.custom<File | undefined>((value) => value === undefined || value instanceof File, {
      message: "Selecciona una imagen válida.",
    }),
    providerExerciseId: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.source === "upload") {
      if (!(value.image instanceof File) || value.image.size === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["image"],
          message: "Selecciona una imagen para el ejercicio.",
        });
        return;
      }

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

    if (value.source === "provider" && !value.providerExerciseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["providerExerciseId"],
        message: "Selecciona un ejercicio de ExerciseDB antes de guardar.",
      });
    }
  });

type CreateExerciseFormValues = z.infer<typeof createExerciseFormSchema>;
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
  const [providerSearchTerm, setProviderSearchTerm] = useState("");
  const [providerCommittedQuery, setProviderCommittedQuery] = useState("");
  const [providerSearchVersion, setProviderSearchVersion] = useState(0);
  const [providerSearchHistory, setProviderSearchHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const storedHistory = window.localStorage.getItem(PROVIDER_SEARCH_HISTORY_STORAGE_KEY);
      if (!storedHistory) return [];

      const parsedHistory = JSON.parse(storedHistory);
      if (!Array.isArray(parsedHistory)) return [];

      return parsedHistory
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .slice(0, PROVIDER_SEARCH_HISTORY_LIMIT);
    } catch {
      return [];
    }
  });
  const [isProviderHistoryOpen, setIsProviderHistoryOpen] = useState(false);
  const [selectedProviderExercise, setSelectedProviderExercise] = useState<ProviderExerciseSummary | null>(null);
  const [editingExercise, setEditingExercise] = useState<ExerciseCatalogItem | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isCreating, startCreateTransition] = useTransition();
  const [isUpdating, startUpdateTransition] = useTransition();
  const [savingExerciseId, setSavingExerciseId] = useState<number | null>(null);
  const [isSavingMedia, startSaveMediaTransition] = useTransition();
  const [pendingPreference, setPendingPreference] = useState<{
    exerciseId: number;
    action: "favorite" | "preview";
  } | null>(null);
  const [isUpdatingPreference, startPreferenceTransition] = useTransition();
  const providerResultsContainerRef = useRef<HTMLDivElement | null>(null);
  const providerLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const providerHistoryCloseTimeoutRef = useRef<number | null>(null);
  const createForm = useForm<CreateExerciseFormValues>({
    resolver: zodResolver(createExerciseFormSchema),
    defaultValues: {
      name: "",
      source: "upload",
      image: undefined,
      providerExerciseId: "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const createSource =
    useWatch({
      control: createForm.control,
      name: "source",
    }) ?? "upload";
  const newExerciseName =
    useWatch({
      control: createForm.control,
      name: "name",
    }) ?? "";
  const shouldValidateCreateForm = createForm.formState.submitCount > 0;

  useEffect(() => {
    return () => {
      if (selectedImagePreview) {
        URL.revokeObjectURL(selectedImagePreview);
      }
    };
  }, [selectedImagePreview]);

  useEffect(() => {
    return () => {
      if (providerHistoryCloseTimeoutRef.current !== null) {
        window.clearTimeout(providerHistoryCloseTimeoutRef.current);
      }
    };
  }, []);

  const providerSearchQuery = useInfiniteQuery({
    queryKey: ["exercise-provider-search", providerCommittedQuery, providerSearchVersion],
    enabled: isCreateDialogOpen && createSource === "provider" && providerCommittedQuery.trim().length > 0,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      searchExerciseProvider({
        query: providerCommittedQuery,
        offset: pageParam,
        limit: PROVIDER_SEARCH_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    staleTime: 60 * 1000,
  });

  const providerResults = providerSearchQuery.data?.pages.flatMap((page) => page.data || []) ?? [];
  const fetchNextProviderPage = providerSearchQuery.fetchNextPage;
  const hasNextProviderPage = providerSearchQuery.hasNextPage;
  const isFetchingNextProviderPage = providerSearchQuery.isFetchingNextPage;
  const isProviderSearchError = providerSearchQuery.isError;
  const isSearchingProvider =
    providerSearchQuery.isLoading || (providerSearchQuery.isFetching && !isFetchingNextProviderPage);
  const providerSearchError =
    providerSearchQuery.error instanceof Error ? providerSearchQuery.error.message : "No se pudo consultar ExerciseDB.";

  useEffect(() => {
    const root = providerResultsContainerRef.current;
    const target = providerLoadMoreRef.current;

    if (!root || !target || !hasNextProviderPage || isFetchingNextProviderPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextProviderPage();
        }
      },
      {
        root,
        rootMargin: "160px 0px",
      },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [
    createSource,
    fetchNextProviderPage,
    hasNextProviderPage,
    isFetchingNextProviderPage,
    providerCommittedQuery,
    providerResults.length,
  ]);

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
        source: "upload",
        image: undefined,
        providerExerciseId: "",
      });
      setProviderSearchTerm("");
      setProviderCommittedQuery("");
      setProviderSearchVersion(0);
      setIsProviderHistoryOpen(false);
      setSelectedProviderExercise(null);
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
  };

  const persistProviderSearchHistory = (nextHistory: string[]) => {
    setProviderSearchHistory(nextHistory);

    try {
      window.localStorage.setItem(PROVIDER_SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
    } catch {
      // Ignore localStorage write errors.
    }
  };

  const handleProviderSearch = (rawQuery?: string) => {
    const effectiveQuery = (rawQuery || providerSearchTerm || newExerciseName).trim();

    if (!effectiveQuery) {
      toast.error("Escribe un nombre en español o inglés para buscar en ExerciseDB.");
      setProviderCommittedQuery("");
      createForm.setValue("providerExerciseId", "", {
        shouldDirty: true,
        shouldValidate: false,
      });
      createForm.clearErrors("providerExerciseId");
      setSelectedProviderExercise(null);
      return;
    }

    const nextHistory = [
      effectiveQuery,
      ...providerSearchHistory.filter((item) => item.toLowerCase() !== effectiveQuery.toLowerCase()),
    ].slice(0, PROVIDER_SEARCH_HISTORY_LIMIT);

    persistProviderSearchHistory(nextHistory);
    setProviderSearchTerm(effectiveQuery);
    setProviderCommittedQuery(effectiveQuery);
    setProviderSearchVersion((current) => current + 1);
    setIsProviderHistoryOpen(false);
    createForm.setValue("providerExerciseId", "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    createForm.clearErrors("providerExerciseId");
    setSelectedProviderExercise(null);
  };

  const handleRemoveProviderHistoryItem = (query: string) => {
    persistProviderSearchHistory(providerSearchHistory.filter((item) => item !== query));
  };

  const openProviderHistory = () => {
    if (providerSearchHistory.length > 0) {
      setIsProviderHistoryOpen(true);
    }
  };

  const scheduleProviderHistoryClose = () => {
    if (providerHistoryCloseTimeoutRef.current !== null) {
      window.clearTimeout(providerHistoryCloseTimeoutRef.current);
    }

    providerHistoryCloseTimeoutRef.current = window.setTimeout(() => {
      setIsProviderHistoryOpen(false);
    }, 120);
  };

  const cancelProviderHistoryClose = () => {
    if (providerHistoryCloseTimeoutRef.current !== null) {
      window.clearTimeout(providerHistoryCloseTimeoutRef.current);
      providerHistoryCloseTimeoutRef.current = null;
    }
  };

  const handleProviderSelect = (exercise: ProviderExerciseSummary) => {
    setSelectedProviderExercise(exercise);
    createForm.setValue("providerExerciseId", exercise.exerciseId, {
      shouldDirty: true,
      shouldValidate: shouldValidateCreateForm,
    });
    createForm.clearErrors("providerExerciseId");
  };

  const handleCreateExercise = createForm.handleSubmit((values) => {
    const trimmedName = values.name.trim();

    startCreateTransition(async () => {
      if (values.source === "provider") {
        if (!selectedProviderExercise) {
          createForm.setError("providerExerciseId", {
            type: "manual",
            message: "Selecciona un ejercicio de ExerciseDB antes de guardar.",
          });
          return;
        }

        try {
          const imported = await importExerciseFromProvider(
            selectedProviderExercise as unknown as Record<string, unknown>,
          );
          const importedName = getExerciseDisplayName(imported.data);

          if (trimmedName !== importedName) {
            const renameResult = await updateExerciseCatalogItem({
              exerciseId: imported.data.id,
              displayName: trimmedName,
            });

            if (!renameResult.success) {
              toast.error(renameResult.error || "El ejercicio se importó, pero no se pudo actualizar el nombre.");
              return;
            }
          }

          const localSaveResult = await saveExerciseMediaToLocal(imported.data.id);
          if (!localSaveResult.success) {
            toast.warning(
              localSaveResult.error || "Se importó el ejercicio, pero no se pudo guardar el GIF localmente.",
            );
          } else {
            toast.success("Ejercicio importado desde ExerciseDB y guardado localmente.");
          }

          handleCreateDialogChange(false);
          router.refresh();
          return;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "No se pudo importar el ejercicio desde ExerciseDB.");
          return;
        }
      }

      const formData = new FormData();
      formData.set("name", trimmedName);
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

  const createPreviewSrc =
    createSource === "provider" ? selectedProviderExercise?.imageUrl || null : selectedImagePreview;
  const createPreviewLabel =
    createSource === "provider"
      ? selectedProviderExercise
        ? `Preview de ${selectedProviderExercise.name}`
        : "Selecciona un ejercicio de ExerciseDB para ver su GIF"
      : "La vista previa aparecerá aquí";
  const createSubmitLabel = createSource === "provider" ? "Guardar desde ExerciseDB" : "Guardar ejercicio";

  const handleUpdateExercise = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingExercise) {
      return;
    }

    startUpdateTransition(async () => {
      const result = await updateExerciseCatalogItem({
        exerciseId: editingExercise.id,
        displayName: editingName,
      });

      if (!result.success) {
        toast.error(result.error || "No se pudo actualizar el ejercicio.");
        return;
      }

      toast.success(result.message || "Ejercicio actualizado correctamente.");
      setEditingExercise(null);
      setEditingName("");
      router.refresh();
    });
  };

  const handleSaveMediaLocally = (exercise: ExerciseCatalogItem) => {
    setSavingExerciseId(exercise.id);

    startSaveMediaTransition(async () => {
      const result = await saveExerciseMediaToLocal(exercise.id);

      if (!result.success) {
        toast.error(result.error || "No se pudo guardar la imagen localmente.");
        setSavingExerciseId(null);
        return;
      }

      toast.success(result.message || "Imagen guardada localmente.");
      setSavingExerciseId(null);
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
                  onSaveMediaLocally={() => handleSaveMediaLocally(exercise)}
                  onToggleFavorite={() => handleToggleFavorite(exercise)}
                  onTogglePreviewVisibility={() => handleTogglePreviewVisibility(exercise)}
                  isSavingMedia={isSavingMedia && savingExerciseId === exercise.id}
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
              Crea un ejercicio local subiendo una imagen propia o eligiendo un GIF de ExerciseDB.
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
                        placeholder={
                          createSource === "provider"
                            ? "Ej. Remo asistido al menton"
                            : "Ej. Sentadilla frontal con mancuerna"
                        }
                      />
                      {createSource === "provider" ? (
                        <FieldDescription>
                          El GIF viene de ExerciseDB, pero el nombre visible lo defines tú.
                        </FieldDescription>
                      ) : null}
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <Tabs
                  value={createSource}
                  onValueChange={(value) => {
                    const nextSource = value as "upload" | "provider";
                    createForm.setValue("source", nextSource, {
                      shouldDirty: true,
                      shouldValidate: false,
                    });

                    if (nextSource === "upload") {
                      createForm.setValue("providerExerciseId", "", {
                        shouldDirty: true,
                        shouldValidate: false,
                      });
                      createForm.clearErrors("providerExerciseId");
                      setSelectedProviderExercise(null);
                    } else {
                      createForm.setValue("image", undefined, {
                        shouldDirty: true,
                        shouldValidate: false,
                      });
                      createForm.clearErrors("image");
                      handleCreateImageChange(null, false);
                    }
                  }}
                  className="space-y-4"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">Subir imagen</TabsTrigger>
                    <TabsTrigger value="provider">Elegir de ExerciseDB</TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)]">
                      <Controller
                        control={createForm.control}
                        name="image"
                        render={({ fieldState }) => (
                          <Field data-invalid={fieldState.invalid} className="space-y-3">
                            <FieldLabel htmlFor="new-exercise-image">Imagen</FieldLabel>
                            <Input
                              id="new-exercise-image"
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              aria-invalid={fieldState.invalid}
                              onChange={(event) => handleCreateImageChange(event.target.files?.[0] ?? null)}
                            />
                            <FieldDescription>
                              Formatos permitidos: JPG, PNG, WEBP o GIF. Tamaño máximo: 5 MB.
                            </FieldDescription>
                            <FieldError errors={[fieldState.error]} />
                          </Field>
                        )}
                      />

                      <ExerciseCreatePreview
                        title="Vista previa"
                        src={createPreviewSrc}
                        emptyLabel={createPreviewLabel}
                        helper="La imagen seleccionada se guardará junto al ejercicio."
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="provider" className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)]">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="provider-exercise-search">Buscar en ExerciseDB</Label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="relative flex-1">
                              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                              <Input
                                id="provider-exercise-search"
                                value={providerSearchTerm}
                                onChange={(event) => setProviderSearchTerm(event.target.value)}
                                onFocus={() => {
                                  cancelProviderHistoryClose();
                                  openProviderHistory();
                                }}
                                onBlur={scheduleProviderHistoryClose}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleProviderSearch();
                                  }
                                }}
                                placeholder="Ej. pantorrillas, glúteo, pecho, remo..."
                                className="pl-9"
                              />
                              {isProviderHistoryOpen && providerSearchHistory.length > 0 ? (
                                <div
                                  className="bg-popover border-border absolute top-[calc(100%+0.5rem)] left-0 z-30 w-full rounded-xl border shadow-xl"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    cancelProviderHistoryClose();
                                  }}
                                >
                                  <div className="border-border flex items-center justify-between border-b px-3 py-2">
                                    <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                                      <History className="size-3.5" />
                                      Ultimas busquedas
                                    </div>
                                    <span className="text-muted-foreground text-[11px]">
                                      {providerSearchHistory.length}/5
                                    </span>
                                  </div>
                                  <div className="max-h-56 overflow-y-auto py-1">
                                    {providerSearchHistory.map((query) => (
                                      <div key={query} className="flex items-center gap-2 px-2 py-1">
                                        <button
                                          type="button"
                                          className="hover:bg-muted flex flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm"
                                          onClick={() => {
                                            setProviderSearchTerm(query);
                                            handleProviderSearch(query);
                                          }}
                                        >
                                          <History className="text-muted-foreground size-4" />
                                          <span className="line-clamp-1">{query}</span>
                                        </button>
                                        <button
                                          type="button"
                                          className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-2 transition"
                                          onClick={() => handleRemoveProviderHistoryItem(query)}
                                          aria-label={`Eliminar ${query} del historial`}
                                        >
                                          <X className="size-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleProviderSearch()}
                              disabled={isSearchingProvider}
                            >
                              {isSearchingProvider ? <Loader2 className="animate-spin" /> : <Search />}
                              Buscar
                            </Button>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            Puedes buscar en español. Probamos traducciones y también consultas por nombre, músculo y
                            equipo cuando aplica.
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>Resultados</Label>
                            <span className="text-muted-foreground text-xs">
                              {providerCommittedQuery
                                ? `${providerResults.length} cargados${hasNextProviderPage ? "+" : ""}`
                                : "Sin busqueda"}
                            </span>
                          </div>

                          <div
                            ref={providerResultsContainerRef}
                            className="max-h-[42vh] space-y-3 overflow-y-auto pr-1"
                          >
                            {!providerCommittedQuery ? (
                              <div className="border-border bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
                                Busca un ejercicio para ver sus GIFs y elegir uno.
                              </div>
                            ) : isSearchingProvider ? (
                              <div className="border-border bg-muted/20 text-muted-foreground flex min-h-40 items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center text-sm">
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Buscando resultados relacionados...
                              </div>
                            ) : isProviderSearchError ? (
                              <div className="border-border bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
                                {providerSearchError}
                              </div>
                            ) : providerResults.length === 0 ? (
                              <div className="border-border bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
                                No encontramos resultados para esa búsqueda.
                              </div>
                            ) : (
                              <>
                                {providerResults.map((exercise) => (
                                  <ProviderExerciseOptionCard
                                    key={exercise.exerciseId}
                                    exercise={exercise}
                                    selected={selectedProviderExercise?.exerciseId === exercise.exerciseId}
                                    onSelect={() => handleProviderSelect(exercise)}
                                  />
                                ))}
                                {hasNextProviderPage ? (
                                  <div
                                    ref={providerLoadMoreRef}
                                    className="text-muted-foreground flex items-center justify-center rounded-xl border border-dashed px-4 py-4 text-sm"
                                  >
                                    {isFetchingNextProviderPage ? (
                                      <>
                                        <Loader2 className="mr-2 size-4 animate-spin" />
                                        Cargando mas resultados...
                                      </>
                                    ) : (
                                      "Desliza para cargar mas resultados"
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground px-2 py-1 text-center text-xs">
                                    No hay mas resultados para esta busqueda.
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          <Controller
                            control={createForm.control}
                            name="providerExerciseId"
                            render={({ fieldState }) => <FieldError errors={[fieldState.error]} />}
                          />
                        </div>
                      </div>

                      <ExerciseCreatePreview
                        title="Vista previa"
                        src={createPreviewSrc}
                        emptyLabel={createPreviewLabel}
                        helper={
                          selectedProviderExercise
                            ? `Seleccionado: ${selectedProviderExercise.name}. Se importará y se guardará localmente.`
                            : "Selecciona uno de los resultados para ver el GIF antes de guardarlo."
                        }
                      />
                    </div>
                  </TabsContent>
                </Tabs>
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
                  {createSubmitLabel}
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
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar nombre</DialogTitle>
            <DialogDescription>Actualiza el nombre visible del ejercicio en el catálogo local.</DialogDescription>
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingExercise(null);
                  setEditingName("");
                }}
                disabled={isUpdating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isUpdating}>
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
  const normalizedSrc = typeof src === "string" ? src : null;
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
  onSaveMediaLocally,
  onToggleFavorite,
  onTogglePreviewVisibility,
  isSavingMedia = false,
  isTogglingFavorite = false,
  isTogglingPreview = false,
  canUpdate = true,
}: {
  exercise: ExerciseCatalogItem;
  showHiddenPreview: boolean;
  onEdit: () => void;
  onSaveMediaLocally: () => void;
  onToggleFavorite: () => void;
  onTogglePreviewVisibility: () => void;
  isSavingMedia: boolean;
  isTogglingFavorite: boolean;
  isTogglingPreview: boolean;
  canUpdate?: boolean;
}) {
  const displayName = getExerciseDisplayName(exercise);
  const isStoredLocally = isExerciseStoredLocally(exercise);
  const providerLabel = getProviderLabel(exercise.provider, isStoredLocally);
  const tags = [...exercise.body_parts, ...exercise.target_muscles, ...exercise.equipments].filter(Boolean).slice(0, 3);
  const canSaveMediaLocally = Boolean(exercise.image_url) && !isStoredLocally;
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
          {canSaveMediaLocally ? (
            <TooltipIconButton label="Guardar en local" onClick={onSaveMediaLocally} disabled={isSavingMedia}>
              {isSavingMedia ? <Loader2 className="animate-spin" /> : <HardDriveDownload />}
            </TooltipIconButton>
          ) : null}
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

function ProviderExerciseOptionCard({
  exercise,
  selected,
  onSelect,
}: {
  exercise: ProviderExerciseSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left transition ${
        selected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="bg-muted/30 h-20 w-24 shrink-0 overflow-hidden rounded-lg border">
          <ExerciseImage
            src={exercise.imageUrl}
            alt={exercise.name}
            className="h-full w-full object-cover"
            loading="lazy"
            fallback={<div className="text-muted-foreground flex h-full items-center justify-center text-xs">Sin GIF</div>}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-3">
            <p className="line-clamp-2 font-medium">{exercise.name}</p>
            <Badge variant={selected ? "success" : "outline"}>{selected ? "Seleccionado" : "ExerciseDB"}</Badge>
          </div>
          <p className="text-muted-foreground text-xs">ID externo: {exercise.exerciseId}</p>
        </div>
      </div>
    </button>
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

  return Boolean(
    exercise.image_url &&
    (exercise.image_url.startsWith("data:image/") ||
      exercise.image_url.includes("/storage/v1/object/public/exercises/")),
  );
}
