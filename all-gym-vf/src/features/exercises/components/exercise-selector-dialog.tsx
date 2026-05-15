"use client";

import { useState, useCallback, useRef } from "react";
import { ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  ExerciseCatalogItem,
  ProviderExerciseSummary,
} from "@/lib/training/types";
import {
  searchExerciseCatalog,
  searchExerciseProvider,
  importExerciseFromProvider,
} from "@/features/routines/actions/exercise-search-actions";

interface ExerciseSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exercise: { id: number; name: string; imageUrl: string | null }) => void;
}

export function ExerciseSelectorDialog({ open, onOpenChange, onSelect }: ExerciseSelectorDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [catalogResults, setCatalogResults] = useState<ExerciseCatalogItem[]>([]);
  const [providerResults, setProviderResults] = useState<ProviderExerciseSummary[]>([]);
  const [showProvider, setShowProvider] = useState(false);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const [isSearchingProvider, setIsSearchingProvider] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  const resetStateRef = useRef(() => {
    setSearchTerm("");
    setCatalogResults([]);
    setProviderResults([]);
    setShowProvider(false);
    onOpenChange(false);
  });

  const handleCatalogSearch = useCallback(async () => {
    if (!searchTerm.trim()) return;
    setIsSearchingCatalog(true);
    try {
      const result = await searchExerciseCatalog({ query: searchTerm.trim(), limit: 15 });
      if (result.success) {
        setCatalogResults(result.data);
      }
    } catch {
      setCatalogResults([]);
    } finally {
      setIsSearchingCatalog(false);
    }
  }, [searchTerm]);

  const handleProviderSearch = useCallback(async () => {
    if (!searchTerm.trim()) return;
    setIsSearchingProvider(true);
    try {
      const result = await searchExerciseProvider({ query: searchTerm.trim(), limit: 15 });
      if (result.success) {
        setProviderResults(result.data);
      }
    } catch {
      setProviderResults([]);
    } finally {
      setIsSearchingProvider(false);
    }
  }, [searchTerm]);

  const handleSelectLocal = useCallback(
    (exercise: ExerciseCatalogItem) => {
      onSelect({
        id: exercise.id,
        name: exercise.display_name_es || exercise.display_name || exercise.name,
        imageUrl: exercise.image_url,
      });
      resetStateRef.current();
    },
    [onSelect],
  );

  const handleImportAndSelect = useCallback(
    async (exercise: ProviderExerciseSummary) => {
      setImportingId(exercise.exerciseId);
      setIsImporting(true);
      try {
        const result = await importExerciseFromProvider(exercise as unknown as Record<string, unknown>);
        if (result.success) {
          onSelect({
            id: result.data.id,
            name: result.data.display_name_es || result.data.display_name || result.data.name,
            imageUrl: result.data.image_url,
          });
          resetStateRef.current();
        }
      } catch {
        // silently fail
      } finally {
        setImportingId(null);
        setIsImporting(false);
      }
    },
    [onSelect],
  );

  // resetState was inlined via useRef above

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Seleccionar ejercicio</DialogTitle>
          <DialogDescription>
            Busca en el catálogo local. Si no encuentras lo que necesitas, puedes consultar ExerciseDB como respaldo.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-7.5rem)] pr-4">
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar ejercicio..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCatalogSearch();
                }}
              />
              <Button variant="outline" onClick={handleCatalogSearch} disabled={isSearchingCatalog}>
                {isSearchingCatalog ? "Buscando..." : "Buscar en catálogo"}
              </Button>
            </div>

            <CatalogResultsSection
              results={catalogResults}
              busy={isImporting}
              onSelect={handleSelectLocal}
            />

            <ProviderSection
              showProvider={showProvider}
              setShowProvider={setShowProvider}
              searchTerm={searchTerm}
              results={providerResults}
              isSearching={isSearchingProvider}
              isImporting={isImporting}
              importingId={importingId}
              onSearch={handleProviderSearch}
              onSelect={handleImportAndSelect}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function CatalogResultsSection({
  results,
  busy,
  onSelect,
}: {
  results: ExerciseCatalogItem[];
  busy: boolean;
  onSelect: (exercise: ExerciseCatalogItem) => void;
}) {
  return (
    <section className="rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-4">
        <h4 className="text-sm font-semibold">Catálogo local</h4>
        <Badge variant="secondary">{results.length}</Badge>
      </div>

      {results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay resultados. Intenta otra búsqueda o consulta ExerciseDB.</p>
      ) : (
        <div className="space-y-3">
          {results.map((ex) => (
            <ExerciseOptionCard
              key={ex.id}
              imageUrl={ex.image_url}
              name={ex.display_name_es || ex.display_name || ex.name}
              tags={[...ex.target_muscles.slice(0, 2), ...ex.equipments.slice(0, 1)]}
              busy={busy}
              label="Usar este ejercicio"
              onSelect={() => onSelect(ex)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProviderSection({
  showProvider,
  setShowProvider,
  searchTerm,
  results,
  isSearching,
  isImporting,
  importingId,
  onSearch,
  onSelect,
}: {
  showProvider: boolean;
  setShowProvider: (v: boolean) => void;
  searchTerm: string;
  results: ProviderExerciseSummary[];
  isSearching: boolean;
  isImporting: boolean;
  importingId: string | null;
  onSearch: () => void;
  onSelect: (exercise: ProviderExerciseSummary) => void;
}) {
  return (
    <div className="rounded-xl border border-dashed p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Respaldo con ExerciseDB</p>
          <p className="text-sm text-muted-foreground">
            Úsalo solo si el catálogo local no tiene lo que necesitas.
          </p>
        </div>
        <Button variant="ghost" onClick={() => setShowProvider(!showProvider)}>
          {showProvider ? "Ocultar respaldo" : "Consultar ExerciseDB"}
        </Button>
      </div>

      {showProvider ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              value={searchTerm}
              readOnly
              placeholder="Buscar también en ExerciseDB..."
            />
            <Button variant="outline" onClick={onSearch} disabled={isSearching || isImporting}>
              {isSearching ? "Consultando..." : "Buscar en ExerciseDB"}
            </Button>
          </div>

          <section className="rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-4">
              <h4 className="text-sm font-semibold">Resultados de ExerciseDB</h4>
              <Badge variant="secondary">{results.length}</Badge>
            </div>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aquí solo aparecerán opciones cuando necesites importar algo externo.
              </p>
            ) : (
              <div className="space-y-3">
                {results.map((ex) => (
                  <div key={ex.exerciseId} className="rounded-lg border bg-background p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 flex-1 gap-4">
                        {ex.imageUrl ? (
                          <div className="h-24 w-28 shrink-0 overflow-hidden rounded-lg border bg-muted/20">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={ex.imageUrl}
                              alt={ex.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
                            <ImageIcon className="size-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium">{ex.name}</p>
                          <p className="text-sm text-muted-foreground">ID externo: {ex.exerciseId}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="lg:min-w-36"
                        onClick={() => onSelect(ex)}
                        disabled={isImporting}
                      >
                        {isImporting && importingId === ex.exerciseId ? "Importando..." : "Importar y usar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ExerciseOptionCard({
  imageUrl,
  name,
  tags,
  busy,
  label,
  onSelect,
}: {
  imageUrl: string | null;
  name: string;
  tags: string[];
  busy: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
            {imageUrl ? (
              <div className="h-24 w-28 shrink-0 overflow-hidden rounded-lg border bg-muted/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt={name} loading="lazy" className="h-full w-full object-cover" />
              </div>
            ) : (
            <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
              <ImageIcon className="size-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 space-y-2">
            <p className="font-medium">{name}</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <Button size="sm" className="lg:min-w-36" onClick={onSelect} disabled={busy}>
          {busy ? "Procesando..." : label}
        </Button>
      </div>
    </div>
  );
}
