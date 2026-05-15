"use client";

import { DataTable } from "@/components/ui/table/data-table";
import { DataTableToolbar } from "@/components/ui/table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { getColumns, type Product, type ProductPermissions } from "./columns";
import { ProductFormSheet } from "../product-form-sheet";
import { useMemo } from "react";

interface ProductTableProps {
  data: Product[];
  totalItems: number;
  canCreate: boolean;
  permissions: ProductPermissions;
}

export function ProductTable({ data, totalItems, canCreate, permissions }: ProductTableProps) {
  const [pageSize] = useQueryState("perPage", parseAsInteger.withDefault(10));
  const pageCount = Math.ceil(totalItems / pageSize);

  const columns = useMemo(() => getColumns(permissions), [permissions]);

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    shallow: false,
    debounceMs: 500,
    storageKey: "products-table",
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table}>
        {canCreate ? <ProductFormSheet /> : null}
      </DataTableToolbar>
    </DataTable>
  );
}
