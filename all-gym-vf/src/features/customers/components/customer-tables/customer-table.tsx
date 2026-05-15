"use client";

import { DataTable } from "@/components/ui/table/data-table";
import { DataTableToolbar } from "@/components/ui/table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { createClient } from "@/lib/supabase/client";
import { parseAsInteger, useQueryState } from "nuqs";
import { getColumns, Customer, PlanOption } from "./columns";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  return Array.from(text).reduce(
    (width, character) => width + estimateCharacterWidth(character),
    0
  );
}

function estimateNameColumnWidth(data: Customer[]) {
  const widestNameWidth = data.reduce((maxWidth, customer) => {
    const fullName = customer.full_name?.trim() ?? "";
    return Math.max(maxWidth, estimateTextWidth(fullName));
  }, 0);

  const headerWidth =
    estimateTextWidth("CLIENTE") + NAME_SORT_ICON_WIDTH + NAME_HEADER_PADDING;

  return clampColumnWidth(
    Math.ceil(
      Math.max(
        headerWidth,
        widestNameWidth + NAME_AVATAR_AND_GAP_WIDTH + NAME_CELL_PADDING + NAME_EXTRA_BUFFER
      )
    )
  );
}

interface CustomerTableProps {
  data: Customer[];
  totalItems: number;
  planOptions?: PlanOption[];
}

export function CustomerTable({ data, totalItems, planOptions = [] }: CustomerTableProps) {
  const router = useRouter();
  const [pageSize] = useQueryState("perPage", parseAsInteger.withDefault(10));
  const [liveData, setLiveData] = useState<Customer[]>(data);

  const pageCount = Math.ceil(totalItems / pageSize);
  const fullNameColumnSize = useMemo(() => estimateNameColumnWidth(liveData), [liveData]);
  const biometricIdList = useMemo(
    () =>
      Array.from(
        new Set(
          liveData
            .map((customer) => customer.biometric_id)
            .filter((value): value is number => Number.isInteger(value)),
        ),
      ),
    [liveData],
  );

  useEffect(() => {
    setLiveData(data);
  }, [data]);

  useEffect(() => {
    if (biometricIdList.length === 0) return;

    const biometricIds = new Set(biometricIdList);

    const supabase = createClient();
    const channel = supabase
      .channel("customers-last-check-in")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_logs" },
        (payload) => {
          const nextRow = payload.new as
            | { biometric_id?: number | null; punch_time?: string | null; status1?: number | null }
            | undefined;

          const biometricId = nextRow?.biometric_id;
          const punchTime = nextRow?.punch_time;
          const status1 = nextRow?.status1;

          if (!Number.isInteger(biometricId) || !punchTime) {
            return;
          }

          const biometricIdNumber = biometricId as number;

          if (!biometricIds.has(biometricIdNumber)) {
            return;
          }

          // Solo reflejamos accesos autorizados para mantener consistente el "último ingreso".
          if (status1 != null && status1 !== 0) {
            return;
          }

          setLiveData((currentData) =>
            currentData.map((customer) => {
              if ((customer.biometric_id ?? null) !== biometricIdNumber) {
                return customer;
              }

              const currentTime = customer.last_check_in ? new Date(customer.last_check_in).getTime() : 0;
              const nextTime = new Date(punchTime).getTime();

              if (!Number.isFinite(nextTime) || nextTime <= currentTime) {
                return customer;
              }

              return {
                ...customer,
                last_check_in: punchTime,
              };
            }),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [biometricIdList]);

  // Generar columnas con las opciones de planes (memoizado)
  const columns = useMemo(
    () => getColumns(planOptions, { fullNameColumnSize }),
    [fullNameColumnSize, planOptions]
  );

  const { table } = useDataTable({
    data: liveData,
    columns,
    pageCount: pageCount,
    shallow: false,
    debounceMs: 500,
    storageKey: "customers-table",
  });

  const handleRowClick = (customer: Customer) => {
    router.push(`/panel/clientes/${customer.id}/history`);
  };

  return (
    <DataTable
      table={table}
      onRowClick={handleRowClick}
      getRowClassName={(row) => (!row.is_active ? "opacity-50 grayscale" : "")}
    >
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
