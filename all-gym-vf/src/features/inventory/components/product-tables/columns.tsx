"use client";

import { ColumnDef } from "@tanstack/react-table";
import { CellAction } from "./cell-action";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
  is_active: boolean;
  last_movement_at: string | null;
  updated_at: string;
};

export interface ProductPermissions {
  canUpdate: boolean;
  canDelete: boolean;
  canAdjustInventory: boolean;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function ProductThumb({ product }: { product: Product }) {
  if (!product.image_url) {
    return <div className="size-9 shrink-0 rounded-md border bg-muted" />;
  }

  return (
    <div
      className="size-9 shrink-0 rounded-md border bg-cover bg-center"
      style={{ backgroundImage: `url(${product.image_url})` }}
      aria-label={`Imagen de ${product.name}`}
    />
  );
}

export function getColumns(permissions: ProductPermissions): ColumnDef<Product>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="PRODUCTO" />,
      enableColumnFilter: true,
      meta: {
        label: "Producto",
        placeholder: "Buscar por nombre, SKU o código...",
        variant: "text" as const,
      },
      filterFn: (row, _id, filterValue) => {
        const search = String(filterValue).toLowerCase().trim();
        if (!search) return true;
        const name = (row.original.name || "").toLowerCase();
        const sku = (row.original.sku || "").toLowerCase();
        const barcode = (row.original.barcode || "").toLowerCase();
        return name.includes(search) || sku.includes(search) || barcode.includes(search);
      },
      cell: ({ row }) => {
        const { name } = row.original;
        return (
          <div className="flex items-center gap-3 min-w-0">
            <ProductThumb product={row.original} />
            <span className="truncate font-medium text-sm">{name}</span>
          </div>
        );
      },
    },
    {
      id: "code",
      accessorKey: "barcode",
      header: ({ column }) => <DataTableColumnHeader column={column} title="CÓDIGO" />,
      cell: ({ row }) => {
        const { barcode, sku } = row.original;
        return (
          <div className="flex flex-col gap-0.5 text-sm">
            <span>{barcode || "-"}</span>
            {sku ? <span className="text-xs text-muted-foreground">SKU {sku}</span> : null}
          </div>
        );
      },
    },
    {
      id: "stock_quantity",
      accessorKey: "stock_quantity",
      header: ({ column }) => <DataTableColumnHeader column={column} title="STOCK" />,
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{formatQuantity(row.original.stock_quantity)}</span>
      ),
    },
    {
      id: "cost_price",
      accessorKey: "cost_price",
      header: ({ column }) => <DataTableColumnHeader column={column} title="COSTO" />,
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatMoney(row.original.cost_price)}</span>,
    },
    {
      id: "sale_price",
      accessorKey: "sale_price",
      header: ({ column }) => <DataTableColumnHeader column={column} title="VENTA" />,
      cell: ({ row }) => <span className="font-medium tabular-nums">{formatMoney(row.original.sale_price)}</span>,
    },
    {
      id: "is_active",
      accessorKey: "is_active",
      header: "ESTADO",
      enableColumnFilter: true,
      meta: {
        label: "Estado",
        variant: "select" as const,
        options: [
          { label: "Activo", value: "true" },
          { label: "Inactivo", value: "false" },
        ],
      },
      filterFn: (row, id, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;
        const isActive = row.getValue(id);
        return filterValue.includes(String(isActive));
      },
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <span className="block text-right">Acciones</span>,
      cell: ({ row }) => <CellAction data={row.original} permissions={permissions} />,
      meta: { disableRowClick: true },
    },
  ];
}
