"use client";

import { DataTable } from "@/components/ui/table/data-table";
import { DataTableToolbar } from "@/components/ui/table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useMemo } from "react";
import { getInventoryMovementColumns, type InventoryMovement } from "./inventory-movements-columns";

interface InventoryMovementsTableProps {
  data: InventoryMovement[];
  totalItems: number;
}

export function InventoryMovementsTable({ data, totalItems }: InventoryMovementsTableProps) {
  const [pageSize] = useQueryState("perPage", parseAsInteger.withDefault(10));
  const pageCount = Math.ceil(totalItems / pageSize);

  const columns = useMemo(() => getInventoryMovementColumns(), []);

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    shallow: false,
    debounceMs: 500,
    storageKey: "inventory-movements-table",
    initialState: {
      sorting: [{ id: "created_at", desc: true }],
    },
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
