"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { parseAsInteger, useQueryState } from "nuqs";
import { DataTable } from "@/components/ui/table/data-table";
import { DataTableToolbar } from "@/components/ui/table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import {
  CashHistorySession,
  CashHistoryOption,
  getColumns,
} from "@/features/cash/components/cash-history-tables/columns";

interface CashHistoryTableProps {
  data: CashHistorySession[];
  totalItems: number;
  userOptions?: CashHistoryOption[];
}

const statusOptions: CashHistoryOption[] = [
  { label: "Abierta", value: "open" },
  { label: "Cerrada", value: "closed" },
  { label: "Con diferencia", value: "closed_with_difference" },
  { label: "Cancelada", value: "cancelled" },
];

export function CashHistoryTable({
  data,
  totalItems,
  userOptions = [],
}: CashHistoryTableProps) {
  const router = useRouter();
  const [pageSize] = useQueryState("perPage", parseAsInteger.withDefault(10));
  const pageCount = Math.ceil(totalItems / pageSize);
  const initialState = useMemo(
    () => ({
      sorting: [{ id: "opened_at" as const, desc: true }],
    }),
    [],
  );

  const columns = useMemo(
    () => getColumns(userOptions, statusOptions),
    [userOptions],
  );

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    shallow: false,
    debounceMs: 500,
    storageKey: "cash-history-table",
    initialState,
  });

  return (
    <DataTable
      table={table}
      onRowClick={(session) => router.push(`/panel/caja/historial/${session.id}`)}
    >
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
