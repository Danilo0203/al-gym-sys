"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconArrowLeft,
  IconBarbell,
  IconLoader2,
  IconPlus,
  IconUser,
} from "@tabler/icons-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";

import type {
  BlueprintDetailRecord,
  BlueprintRecord,
  BlueprintAssignmentRecord,
} from "@/features/routines/actions/blueprint-actions";
import {
  assignRoutineBlueprint,
  getRoutineBlueprintDetail,
  unassignRoutineBlueprint,
} from "@/features/routines/actions/blueprint-actions";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";

import {
  getStatusBadgeVariant,
  getStatusLabel,
  RoutineViewer,
  buildEditorState,
  type DetailEditorState,
} from "@/features/customers/components/customer-history/tabs/routine-workspace-shared";
import type { RoutineRecord, RoutineDetailRecord } from "@/lib/training/types";

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

function blueprintToRoutineRecord(bp: BlueprintRecord): RoutineRecord {
  return {
    id: bp.id,
    user_id: null,
    created_by: bp.created_by,
    name: bp.name,
    start_date: null,
    end_date: null,
    is_active: true,
    goal: bp.primary_goal,
    status: "active",
    source: "admin",
    training_profile_id: null,
    primary_goal: bp.primary_goal,
    secondary_goal: bp.secondary_goal,
    generation_version: null,
    reviewed_by: null,
    reviewed_at: bp.updated_at,
    created_at: bp.created_at,
  };
}

function detailToRoutineDetail(d: BlueprintDetailRecord): RoutineDetailRecord {
  return {
    id: d.id,
    routine_id: d.blueprint_id,
    day_of_week: d.day_of_week,
    exercise_id: d.exercise_id,
    exercise_order: d.exercise_order,
    block_type: d.block_type,
    sets: d.sets,
    reps: d.reps,
    rest_seconds: d.rest_seconds,
    duration_minutes: d.duration_minutes,
    target_rir: d.target_rir,
    notes: d.notes,
    exercise_name_snapshot: d.exercise_name_snapshot,
    exercise_image_url: d.exercise_image_url,
    exercise_video_url: d.exercise_video_url,
  };
}

interface BlueprintDetailViewProps {
  data: {
    blueprint: BlueprintRecord;
    details: BlueprintDetailRecord[];
    assignments: BlueprintAssignmentRecord[];
  };
}

function AssignDialog({ blueprintId }: { blueprintId: string }) {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const canAssign = Boolean(currentUser?.isOwner || currentUser?.permissions?.includes("routines.view"));
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const deferredQuery = useDeferredValue(query.trim());

  const clientsQuery = useInfiniteQuery<ClientPage>({
    queryKey: ["routine-blueprint-clients", blueprintId, deferredQuery],
    enabled: open,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const url = new URL("/api/panel/clientes", window.location.origin);
      url.searchParams.set("offset", String(pageParam));
      url.searchParams.set("limit", String(CLIENT_PAGE_SIZE));
      if (deferredQuery) {
        url.searchParams.set("query", deferredQuery);
      }

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

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
  const blueprintDetailQuery = useQuery({
    queryKey: ["routine-blueprint-detail", blueprintId],
    queryFn: () => getRoutineBlueprintDetail(blueprintId),
    enabled: open,
    staleTime: 60 * 1000,
  });
  const assignedIds = new Set(blueprintDetailQuery.data?.assignments.map((assignment) => assignment.user_id) ?? []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const viewport = scrollAreaRef.current?.querySelector(
      "[data-slot='scroll-area-viewport']",
    ) as HTMLDivElement | null;

    if (viewport) {
      viewport.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [deferredQuery, open]);

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
      {
        root: viewport,
        rootMargin: "160px 0px",
      },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [clients.length, fetchNextPage, hasNextPage, isFetchingNextPage, open]);

  const handleAssign = async (userId: string) => {
    try {
      setAssigningId(userId);
      await assignRoutineBlueprint({ blueprintId, userId });
      toast.success("Rutina asignada correctamente.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["routine-blueprint-detail", blueprintId] }),
        queryClient.invalidateQueries({ queryKey: ["routine-blueprint-clients", blueprintId] }),
      ]);
      setOpen(false);
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
        queryClient.invalidateQueries({ queryKey: ["routine-blueprint-clients", blueprintId] }),
      ]);
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo quitar.");
    } finally {
      setAssigningId(null);
    }
  };

  const isInitialLoading = clientsQuery.isLoading && clients.length === 0;
  const isEmpty = !isInitialLoading && clients.length === 0 && !clientsQuery.isError;

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) {
          setQuery("");
        }
      }}
    >
      {canAssign && (
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <IconPlus className="size-4" />
          Asignar plantilla
        </Button>
      </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar a un cliente</DialogTitle>
          <DialogDescription>
            Busca y selecciona un cliente para asignarle esta plantilla.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar cliente..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ScrollArea className="h-[420px]" ref={scrollAreaRef}>
            {clientsQuery.isError || blueprintDetailQuery.isError ? (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                No se pudieron cargar los clientes.
              </div>
            ) : (isInitialLoading || blueprintDetailQuery.isLoading) ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
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
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{client.full_name}</p>
                    </div>
                    {assigningId === client.id ? (
                      <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : assignedIds.has(client.id) ? (
                      <span className="text-xs font-medium text-destructive">Quitar</span>
                    ) : (
                      <IconPlus className="size-4 text-muted-foreground" />
                    )}
                  </button>
                ))}
                <div ref={sentinelRef} className="h-1" />
                {isFetchingNextPage ? (
                  <div className="space-y-2 p-2">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                  </div>
                ) : null}
              </div>
            ) : isEmpty ? (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                No hay clientes para mostrar.
              </div>
            ) : null}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BlueprintDetailView({ data }: BlueprintDetailViewProps) {
  const { blueprint, details, assignments } = data;
  const routineRecord = blueprintToRoutineRecord(blueprint);
  const detailRecords = details.map(detailToRoutineDetail);
  const emptyEditors: Record<number, DetailEditorState> = {};
  for (const d of detailRecords) {
    emptyEditors[d.id] = buildEditorState(d);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" className="h-auto px-0 text-muted-foreground hover:bg-transparent">
          <Link href="/panel/rutinas">
            <IconArrowLeft className="size-4" />
            Volver a plantillas
          </Link>
        </Button>
        <AssignDialog blueprintId={blueprint.id} />
      </div>

      <RoutineViewer
        title="Detalle de plantilla"
        routine={routineRecord}
        details={detailRecords}
        editable={false}
        canReplace={false}
        editors={emptyEditors}
        onEditorChange={() => undefined}
        onSave={async () => undefined}
        onReplace={() => undefined}
        busyDetailId={null}
      />

      <Card>
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <IconUser className="size-5" />
            Clientes asignados
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {assignments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Esta plantilla no está asignada a ningún cliente todavía.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/30"
                >
                  <Avatar className="size-9">
                    <AvatarImage
                      src={assignment.customer_avatar ?? undefined}
                      alt={assignment.customer_name ?? "Cliente"}
                    />
                    <AvatarFallback className="text-xs">
                      {getInitials(assignment.customer_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">
                      {assignment.customer_name ?? "Cliente"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant={getStatusBadgeVariant(
                          (assignment.routine_status as RoutineRecord["status"]) || "draft",
                        )}
                        className="h-4 text-[10px]"
                      >
                        {getStatusLabel(
                          (assignment.routine_status as RoutineRecord["status"]) || "draft",
                        )}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {new Intl.DateTimeFormat("es-MX", {
                          day: "2-digit",
                          month: "short",
                        }).format(new Date(assignment.assigned_at))}
                      </span>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="gap-1">
                    <Link href={`/panel/clientes/${assignment.user_id}/rutina/activa`}>
                      <IconBarbell className="size-3.5" />
                      Ver rutina
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
