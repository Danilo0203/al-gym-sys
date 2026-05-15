"use client";

import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconLoader2, IconPencil } from "@tabler/icons-react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";
import { Skeleton } from "@/components/ui/skeleton";
import {
  assignRoutineBlueprint,
  getRoutineBlueprintDetail,
  unassignRoutineBlueprint,
  updateRoutineBlueprintName,
} from "@/features/routines/actions/blueprint-actions";

const CLIENT_PAGE_SIZE = 12;

type ClientListItem = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

type ClientPage = {
  data: ClientListItem[];
  nextOffset: number | null;
};

function getInitials(name: string | null) {
  const source = (name ?? "").trim();
  if (!source) return "?";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function BlueprintRenameDialog({
  blueprintId,
  currentName,
}: {
  blueprintId: string;
  currentName: string;
}) {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const canManage = Boolean(currentUser?.isOwner || currentUser?.permissions?.includes("routines.view"));
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm.trim());

  const blueprintDetailQuery = useQuery({
    queryKey: ["routine-blueprint-detail", blueprintId],
    queryFn: () => getRoutineBlueprintDetail(blueprintId),
    enabled: open,
    staleTime: 60 * 1000,
  });

  const clientsQuery = useInfiniteQuery<ClientPage>({
    queryKey: ["routine-blueprint-modal-clients", blueprintId, deferredSearchTerm],
    enabled: open,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const url = new URL("/api/panel/clientes", window.location.origin);
      url.searchParams.set("offset", String(pageParam));
      url.searchParams.set("limit", String(CLIENT_PAGE_SIZE));
      if (deferredSearchTerm) {
        url.searchParams.set("query", deferredSearchTerm);
      }

      const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error("No se pudieron cargar los clientes.");
      }

      return (await response.json()) as ClientPage;
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    staleTime: 60 * 1000,
  });

  const clients = clientsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const hasNextPage = clientsQuery.hasNextPage;
  const isFetchingNextPage = clientsQuery.isFetchingNextPage;
  const fetchNextPage = clientsQuery.fetchNextPage;
  const assignedIds = new Set(blueprintDetailQuery.data?.assignments.map((assignment) => assignment.user_id) ?? []);

  useEffect(() => {
    if (!open) return;

    const viewport = scrollAreaRef.current?.querySelector(
      "[data-slot='scroll-area-viewport']",
    ) as HTMLDivElement | null;
    const target = sentinelRef.current;

    if (!viewport || !target || !hasNextPage || isFetchingNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextPage();
        }
      },
      { root: viewport, rootMargin: "160px 0px" },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [clients.length, fetchNextPage, hasNextPage, isFetchingNextPage, open]);

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      return;
    }

    const viewport = scrollAreaRef.current?.querySelector(
      "[data-slot='scroll-area-viewport']",
    ) as HTMLDivElement | null;

    viewport?.scrollTo({ top: 0, behavior: "auto" });
  }, [deferredSearchTerm, open]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateRoutineBlueprintName({ blueprintId, name });
      toast.success("Plantilla actualizada.");
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssign = async (userId: string) => {
    try {
      setAssigningId(userId);
      await assignRoutineBlueprint({ blueprintId, userId });
      toast.success("Cliente asignado.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["routine-blueprint-detail", blueprintId] }),
        queryClient.invalidateQueries({ queryKey: ["routine-blueprint-modal-clients", blueprintId] }),
      ]);
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo asignar.");
    } finally {
      setAssigningId(null);
    }
  };

  const handleUnassign = async (userId: string) => {
    try {
      setAssigningId(userId);
      await unassignRoutineBlueprint({ blueprintId, userId });
      toast.success("Cliente quitado de la plantilla.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["routine-blueprint-detail", blueprintId] }),
        queryClient.invalidateQueries({ queryKey: ["routine-blueprint-modal-clients", blueprintId] }),
      ]);
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo quitar.");
    } finally {
      setAssigningId(null);
    }
  };

  if (!canManage) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setName(currentName);
        }
      }}
    >
      {canManage && (
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <IconPencil className="size-3.5" />
          Editar
        </Button>
      </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar plantilla</DialogTitle>
          <DialogDescription>
            Cambia el nombre visible de esta plantilla.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre de la plantilla"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium">Asignar clientes</p>
              <p className="text-xs text-muted-foreground">
                Busca un cliente y asígnalo desde este mismo modal.
              </p>
            </div>
            <Input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <ScrollArea className="h-64" ref={scrollAreaRef}>
              {clientsQuery.isError || blueprintDetailQuery.isError ? (
                <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
                  No se pudieron cargar los clientes.
                </div>
              ) : (clientsQuery.isLoading || blueprintDetailQuery.isLoading) && clients.length === 0 ? (
                <div className="space-y-2 p-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : clients.length > 0 ? (
                <div className="space-y-1">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() =>
                        void (assignedIds.has(client.id)
                          ? handleUnassign(client.id)
                          : handleAssign(client.id))
                      }
                      disabled={assigningId === client.id}
                      className="flex w-full items-center gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <Avatar className="size-8">
                        <AvatarImage src={client.avatar_url ?? undefined} alt={client.full_name} />
                        <AvatarFallback className="text-xs">{getInitials(client.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{client.full_name}</p>
                      </div>
                      {assigningId === client.id ? (
                        <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
                      ) : assignedIds.has(client.id) ? (
                        <span className="text-xs font-medium text-destructive">Quitar</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Asignar</span>
                      )}
                    </button>
                  ))}
                  <div ref={sentinelRef} className="h-1" />
                  {isFetchingNextPage ? (
                    <div className="space-y-2 p-1">
                      <Skeleton className="h-12 w-full rounded-lg" />
                      <Skeleton className="h-12 w-full rounded-lg" />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
                  Sin resultados.
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
