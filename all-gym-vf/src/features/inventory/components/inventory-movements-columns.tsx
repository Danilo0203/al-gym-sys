"use client";

import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { ColumnDef } from "@tanstack/react-table";
import type { InventoryMovementItem, InventoryMovementType } from "@/features/inventory/actions/inventory-actions";

export type InventoryMovement = InventoryMovementItem;

function formatMoney(amount: number | null | undefined) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Guatemala",
  }).format(new Date(value));
}

function formatQuantity(value: number | null | undefined) {
  const quantity = value || 0;
  const formatted = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return quantity > 0 ? `+${formatted}` : formatted;
}

function getMovementLabel(type: InventoryMovementType) {
  switch (type) {
    case "entry":
      return "Entrada";
    case "sale":
      return "Venta";
    case "manual_exit":
      return "Salida manual";
    case "adjustment":
      return "Ajuste físico";
    case "void":
      return "Anulación";
    default:
      return type;
  }
}

function getMovementVariant(type: InventoryMovementType) {
  switch (type) {
    case "entry":
      return "success" as const;
    case "sale":
    case "manual_exit":
      return "warning" as const;
    case "adjustment":
      return "secondary" as const;
    case "void":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function getInventoryMovementColumns(): ColumnDef<InventoryMovement>[] {
  return [
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <DataTableColumnHeader column={column} title="FECHA" />,
      cell: ({ row }) => <span className="whitespace-nowrap text-sm">{formatDateTime(row.original.created_at)}</span>,
    },
    {
      id: "name",
      accessorKey: "product_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="PRODUCTO" />,
      enableColumnFilter: true,
      meta: {
        label: "Producto",
        placeholder: "Buscar por producto",
        variant: "text" as const,
      },
      filterFn: (row, _id, filterValue) => {
        const search = String(filterValue).toLowerCase().trim();
        if (!search) return true;

        const productName = (row.original.product_name || "").toLowerCase();
        return productName.includes(search);
      },
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.product_name}</span>,
    },
    {
      id: "category",
      accessorKey: "movement_type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="TIPO" />,
      enableColumnFilter: true,
      meta: {
        label: "Tipo",
        variant: "select" as const,
        options: [
          { label: "Entrada", value: "entry" },
          { label: "Venta", value: "sale" },
          { label: "Salida manual", value: "manual_exit" },
          { label: "Ajuste físico", value: "adjustment" },
          { label: "Anulación", value: "void" },
        ],
      },
      filterFn: (row, _id, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;
        return filterValue.includes(row.original.movement_type);
      },
      cell: ({ row }) => <Badge variant={getMovementVariant(row.original.movement_type)}>{getMovementLabel(row.original.movement_type)}</Badge>,
    },
    {
      id: "quantity_delta",
      accessorKey: "quantity_delta",
      header: ({ column }) => <DataTableColumnHeader column={column} title="CANTIDAD" />,
      cell: ({ row }) => <span className="font-medium tabular-nums">{formatQuantity(row.original.quantity_delta)}</span>,
    },
    {
      id: "stock",
      header: "STOCK",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">
          {row.original.quantity_before ?? "-"} → {row.original.quantity_after ?? "-"}
        </span>
      ),
    },
    {
      id: "reference",
      header: "REFERENCIA",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.sale_number || row.original.note || "-"}</span>,
    },
    {
      id: "created_by_name",
      accessorKey: "created_by_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="USUARIO" />,
      cell: ({ row }) => <span className="text-sm">{row.original.created_by_name || "Usuario"}</span>,
    },
    {
      id: "value",
      header: ({ column }) => <DataTableColumnHeader column={column} title="VALOR" />,
      cell: ({ row }) => <span className="font-medium tabular-nums">{formatMoney(row.original.unit_price || row.original.unit_cost)}</span>,
    },
  ];
}
