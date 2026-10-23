"use client";

import { ExerciseMedia } from "@/features/exercises/components/exercise-media";

import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { searchExerciseCatalog } from "@/features/routines/actions/exercise-search-actions";
import { isExerciseMediaStoredLocally } from "@/lib/training/exercise-media";
import type { ExerciseCatalogItem } from "@/lib/training/types";

const PAGE_SIZE = 20;

interface ExerciseSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exercise: { id: number; name: string; imageUrl: string | null }) => void;
}

export function ExerciseSelectorDialog({ open, onOpenChange, onSelect }: ExerciseSelectorDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["routine-exercise-selector", submittedQuery],
    queryFn: ({ pageParam }) => searchExerciseCatalog({
      query: submittedQuery,
      limit: PAGE_SIZE,
      offset: pageParam,
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => lastPage.hasMore
      ? pages.reduce((count, page) => count + page.data.length, 0)
      : undefined,
    enabled: open,
  });

  const results = data?.pages.flatMap((page) => page.data) ?? [];

  useEffect(() => {
    if (!open || !hasNextPage || isFetchingNextPage || error) return;

    const viewport = scrollAreaRef.current?.querySelector(
      "[data-slot='scroll-area-viewport']",
    ) as HTMLDivElement | null;
    const sentinel = sentinelRef.current;
    if (!viewport || !sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchNextPage();
    }, { root: viewport, rootMargin: "120px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, fetchNextPage, hasNextPage, isFetchingNextPage, open, results.length]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearchTerm("");
      setSubmittedQuery("");
    }
    onOpenChange(nextOpen);
  };

  const handleSearch = () => {
    const query = searchTerm.trim();
    scrollAreaRef.current?.querySelector("[data-slot='scroll-area-viewport']")?.scrollTo({ top: 0 });
    if (query === submittedQuery) {
      void refetch();
    } else {
      setSubmittedQuery(query);
    }
  };

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
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Seleccionar ejercicio</DialogTitle>
          <DialogDescription>
            Busca ejercicios e imágenes guardados en este equipo. Puedes añadir otros desde el catálogo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar ejercicio..."
              onKeyDown={(event) => { if (event.key === "Enter") handleSearch(); }}
            />
            <Button variant="outline" onClick={handleSearch}>
              Buscar en catálogo
            </Button>
          </div>
          <section className="flex min-h-0 flex-col rounded-xl border">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <h4 className="text-sm font-semibold">Catálogo local</h4>
              <Badge variant="secondary">{results.length}</Badge>
            </div>
            <ScrollArea ref={scrollAreaRef} className={results.length > 0 ? "h-[min(50vh,28rem)]" : "max-h-[50vh]"}>
              <div className="divide-y px-2">
                {results.map((exercise) => {
                  const name = exercise.display_name_es || exercise.display_name || exercise.name;
                  return (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => handleSelect(exercise)}
                      className="hover:bg-muted/50 focus-visible:ring-ring flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
                    >
                      {isExerciseMediaStoredLocally(exercise.image_url) ? (
                        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/20">
                          <ExerciseMedia controls={false} src={exercise.image_url} alt="" loading="lazy" className="h-full w-full object-contain" />
                        </span>
                      ) : (
                        <span className="flex size-16 shrink-0 items-center justify-center rounded-md border bg-muted/20">
                          <ImageIcon className="size-5 text-muted-foreground" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{name}</span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {[...exercise.target_muscles.slice(0, 2), ...exercise.equipments.slice(0, 1)].map((tag, index) => (
                            <Badge key={`${tag}-${index}`} variant="outline">{tag}</Badge>
                          ))}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">Seleccionar</span>
                    </button>
                  );
                })}
                {isPending ? <p className="p-4 text-sm text-muted-foreground">Cargando ejercicios...</p> : null}
                {error ? (
                  <div className="flex items-center justify-between gap-3 p-4">
                    <p className="text-sm text-destructive">No se pudo consultar el catálogo local.</p>
                    <Button size="sm" variant="outline" onClick={() => void (results.length > 0 ? fetchNextPage() : refetch())}>
                      Reintentar
                    </Button>
                  </div>
                ) : null}
                {!isPending && !error && results.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No hay resultados. Añade el ejercicio desde el catálogo local. Puedes agregar su imagen después.</p>
                ) : null}
                {isFetchingNextPage ? <p className="p-4 text-center text-sm text-muted-foreground">Cargando más ejercicios...</p> : null}
                {hasNextPage ? <div ref={sentinelRef} aria-hidden="true" className="h-1" /> : null}
              </div>
            </ScrollArea>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
