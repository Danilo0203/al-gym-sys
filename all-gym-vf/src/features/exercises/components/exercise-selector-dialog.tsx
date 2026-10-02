"use client";

import { useCallback, useState } from "react";
import { ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { searchExerciseCatalog } from "@/features/routines/actions/exercise-search-actions";
import type { ExerciseCatalogItem } from "@/lib/training/types";

interface ExerciseSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exercise: { id: number; name: string; imageUrl: string | null }) => void;
}

export function ExerciseSelectorDialog({ open, onOpenChange, onSelect }: ExerciseSelectorDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<ExerciseCatalogItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearchTerm("");
      setResults([]);
      setHasSearched(false);
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setError(null);
    try {
      const result = await searchExerciseCatalog({ query: searchTerm.trim(), limit: 15 });
      setResults(result.data);
    } catch {
      setResults([]);
      setError("No se pudo consultar el catálogo local.");
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm]);

  const handleSelect = (exercise: ExerciseCatalogItem) => {
    onSelect({
      id: exercise.id,
      name: exercise.display_name_es || exercise.display_name || exercise.name,
      imageUrl: exercise.image_url,
    });
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Seleccionar ejercicio</DialogTitle>
          <DialogDescription>
            Busca ejercicios e imágenes guardados en este equipo. Puedes añadir otros desde el catálogo.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-7.5rem)] pr-4">
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar ejercicio..."
                onKeyDown={(event) => { if (event.key === "Enter") void handleSearch(); }}
              />
              <Button variant="outline" onClick={() => void handleSearch()} disabled={isSearching}>
                {isSearching ? "Buscando..." : "Buscar en catálogo"}
              </Button>
            </div>
            <section className="rounded-xl border p-4">
              <div className="mb-4 flex items-center gap-2">
                <h4 className="text-sm font-semibold">Catálogo local</h4>
                <Badge variant="secondary">{results.length}</Badge>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {results.length === 0 && !error ? (
                <p className="text-sm text-muted-foreground">
                  {hasSearched
                    ? "No hay resultados. Añade el ejercicio desde el catálogo local. Puedes agregar su imagen después."
                    : "Escribe un nombre y busca en el catálogo local."}
                </p>
              ) : null}
              <div className="space-y-3">
                {results.map((exercise) => {
                  const name = exercise.display_name_es || exercise.display_name || exercise.name;
                  return (
                    <div key={exercise.id} className="rounded-lg border bg-background p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 flex-1 gap-4">
                          {exercise.image_url ? (
                            <div className="h-24 w-28 shrink-0 overflow-hidden rounded-lg border bg-muted/20">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={exercise.image_url} alt={name} loading="lazy" className="h-full w-full object-cover" />
                            </div>
                          ) : (
                            <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
                              <ImageIcon className="size-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0 space-y-2">
                            <p className="font-medium">{name}</p>
                            <div className="flex flex-wrap gap-2">
                              {[...exercise.target_muscles.slice(0, 2), ...exercise.equipments.slice(0, 1)].map((tag) => (
                                <Badge key={tag} variant="outline">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => handleSelect(exercise)}>Usar este ejercicio</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
