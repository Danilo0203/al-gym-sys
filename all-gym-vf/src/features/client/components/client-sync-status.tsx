"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { IconCloudCheck, IconCloudOff } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import type { ClientApiMeta } from "@/features/client/types";
import { useOnlineStatus } from "@/features/client/hooks/use-online-status";

interface ClientSyncStatusProps {
  meta?: ClientApiMeta | null;
}

export function ClientSyncStatus({ meta }: ClientSyncStatusProps) {
  const isOnline = useOnlineStatus();
  const lastSyncLabel = meta?.fetched_at
    ? format(new Date(meta.fetched_at), "d MMM yyyy, HH:mm", { locale: es })
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant={isOnline ? "success" : "warning"} className="gap-1">
        {isOnline ? <IconCloudCheck className="h-3.5 w-3.5" /> : <IconCloudOff className="h-3.5 w-3.5" />}
        {isOnline ? "En línea" : "Datos sin conexión"}
      </Badge>
      {lastSyncLabel ? <span>Última sincronización: {lastSyncLabel}</span> : null}
    </div>
  );
}
