"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { CashSessionView } from "@/features/cash/actions/cash-actions";

export type CashHistorySession = CashSessionView;

export interface CashHistoryOption {
  label: string;
  value: string;
}

const defaultStatusOptions: CashHistoryOption[] = [
  { label: "Abierta", value: "open" },
  { label: "Cerrada", value: "closed" },
  { label: "Con diferencia", value: "closed_with_difference" },
  { label: "Cancelada", value: "cancelled" },
];

function formatMoney(amount: number | null | undefined) {
  const safeAmount = typeof amount === "number" ? amount : 0;

  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(safeAmount);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return <span className="text-muted-foreground text-sm">Sin fecha</span>;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return <span className="text-muted-foreground text-sm">{value}</span>;
  }

  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium">
        {format(parsedDate, "dd/MM/yy", { locale: es })}
      </span>
      <span className="text-xs text-muted-foreground">
        {format(parsedDate, "h:mm a", { locale: es })}
      </span>
    </div>
  );
}

function getStatusBadge(status: CashHistorySession["status"]) {
  switch (status) {
    case "open":
      return <Badge variant="destructive">Abierta</Badge>;
    case "closed":
      return <Badge variant="secondary">Cerrada</Badge>;
    case "closed_with_difference":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Con diferencia</Badge>;
    case "cancelled":
      return <Badge variant="outline">Cancelada</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function getColumns(
  userOptions: CashHistoryOption[] = [],
  statusOptions: CashHistoryOption[] = defaultStatusOptions,
): ColumnDef<CashHistorySession>[] {
  return [
    {
      id: "session_number",
      accessorKey: "session_number",
      size: 190,
      minSize: 180,
      header: ({ column }) => <DataTableColumnHeader column={column} title="SESIÓN" />,
      enableColumnFilter: true,
      meta: {
        label: "Sesión",
        placeholder: "Buscar sesión...",
        variant: "text" as const,
      },
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-medium">{row.original.session_number}</span>
      ),
    },
    {
      id: "cash_register_name",
      accessorKey: "cash_register_name",
      size: 180,
      minSize: 160,
      header: ({ column }) => <DataTableColumnHeader column={column} title="CAJA" />,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.cash_register_name}</span>
      ),
    },
    {
      id: "opened_by_user_id",
      accessorKey: "opened_by_user_id",
      size: 190,
      minSize: 170,
      header: ({ column }) => <DataTableColumnHeader column={column} title="ABRIÓ" />,
      enableColumnFilter: true,
      enableSorting: false,
      meta: {
        label: "Abrió",
        variant: "select" as const,
        options: userOptions,
      },
      cell: ({ row }) => (
        <span className="text-sm">{row.original.opened_by_name || "Usuario"}</span>
      ),
    },
    {
      id: "closed_by_user_id",
      accessorKey: "closed_by_user_id",
      size: 190,
      minSize: 170,
      header: ({ column }) => <DataTableColumnHeader column={column} title="CERRÓ" />,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.closed_by_name || "Pendiente"}</span>
      ),
    },
    {
      id: "opened_at",
      accessorKey: "opened_at",
      size: 160,
      minSize: 150,
      header: ({ column }) => <DataTableColumnHeader column={column} title="APERTURA" />,
      enableColumnFilter: true,
      meta: {
        label: "Apertura",
        variant: "dateRange" as const,
      },
      cell: ({ row }) => formatDateTime(row.original.opened_at),
    },
    {
      id: "closed_at",
      accessorKey: "closed_at",
      size: 160,
      minSize: 150,
      header: ({ column }) => <DataTableColumnHeader column={column} title="CIERRE" />,
      cell: ({ row }) => formatDateTime(row.original.closed_at),
    },
    {
      id: "opening_amount",
      accessorKey: "opening_amount",
      size: 130,
      minSize: 120,
      header: ({ column }) => <DataTableColumnHeader column={column} title="FONDO" />,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">{formatMoney(row.original.opening_amount)}</span>
      ),
    },
    {
      id: "difference_amount",
      accessorKey: "difference_amount",
      size: 140,
      minSize: 130,
      header: ({ column }) => <DataTableColumnHeader column={column} title="DIFERENCIA" />,
      cell: ({ row }) => {
        const amount = row.original.difference_amount ?? 0;
        const hasDifference = Math.abs(amount) > 0;

        return (
          <span
            className={`whitespace-nowrap text-sm font-medium ${hasDifference ? "text-amber-600" : "text-muted-foreground"}`}
          >
            {formatMoney(amount)}
          </span>
        );
      },
    },
    {
      id: "status",
      accessorKey: "status",
      size: 150,
      minSize: 140,
      header: ({ column }) => <DataTableColumnHeader column={column} title="ESTADO" />,
      enableColumnFilter: true,
      meta: {
        label: "Estado",
        variant: "select" as const,
        options: statusOptions,
      },
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      id: "actions",
      size: 130,
      minSize: 120,
      header: () => <div className="text-right">ACCIONES</div>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" asChild onClick={(event) => event.stopPropagation()}>
            <Link href={`/panel/caja/historial/${row.original.id}`}>Ver detalle</Link>
          </Button>
        </div>
      ),
    },
  ];
}
