"use client";

import { useMemo } from "react";
import { parseAsInteger, useQueryState } from "nuqs";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/table/data-table";
import { DataTableToolbar } from "@/components/ui/table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { getColumns, type Customer } from "./columns";

const MIN_NAME_COLUMN_WIDTH = 180;
const MAX_NAME_COLUMN_WIDTH = 280;
const NAME_CELL_PADDING = 16;
const NAME_HEADER_PADDING = 24;
const NAME_SORT_ICON_WIDTH = 20;
const NAME_AVATAR_AND_GAP_WIDTH = 48;
const NAME_EXTRA_BUFFER = 12;

function clampColumnWidth(width: number) {
  return Math.min(MAX_NAME_COLUMN_WIDTH, Math.max(MIN_NAME_COLUMN_WIDTH, width));
}

function estimateCharacterWidth(character: string) {
  if (character === " ") return 4;
  if (".,:;!'`|ijlI".includes(character)) return 4.5;
  if ("frtJ".includes(character)) return 6;
  if ("mwMW@#%&QO".includes(character)) return 10.5;
  if (/[A-ZÁÉÍÓÚÑ]/.test(character)) return 8.75;
  if (/[0-9]/.test(character)) return 7.5;

  return 7.25;
}

function estimateTextWidth(text: string) {
  return Array.from(text).reduce((width, character) => width + estimateCharacterWidth(character), 0);
}

function estimateNameColumnWidth(data: Customer[]) {
  const widestNameWidth = data.reduce((maxWidth, customer) => {
    return Math.max(maxWidth, estimateTextWidth(customer.full_name?.trim() ?? ""));
  }, 0);

  const headerWidth = estimateTextWidth("CLIENTE") + NAME_SORT_ICON_WIDTH + NAME_HEADER_PADDING;

  return clampColumnWidth(
    Math.ceil(
      Math.max(headerWidth, widestNameWidth + NAME_AVATAR_AND_GAP_WIDTH + NAME_CELL_PADDING + NAME_EXTRA_BUFFER),
    ),
  );
}

interface CustomerTableProps {
  data: Customer[];
  totalItems: number;
  canUpdate: boolean;
}

export function CustomerTable({ data, totalItems, canUpdate }: CustomerTableProps) {
  const router = useRouter();
  const [pageSize] = useQueryState("perPage", parseAsInteger.withDefault(10));
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const fullNameColumnSize = useMemo(() => estimateNameColumnWidth(data), [data]);
  const columns = useMemo(
    () => getColumns({ fullNameColumnSize, canUpdate }),
    [canUpdate, fullNameColumnSize],
  );

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    shallow: false,
    debounceMs: 500,
    storageKey: "customers-table",
  });

  return (
    <DataTable
      table={table}
      onRowClick={(customer) => router.push(`/panel/clientes/${customer.id}/history`)}
      getRowClassName={(customer) => (!customer.is_active ? "opacity-50 grayscale" : "")}
    >
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
