'use client';

import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { parseAsInteger, useQueryState } from 'nuqs';
import { columns } from './columns';
import { Plan } from '../../actions/plan-actions';
import { useMemo } from 'react';

interface PlanTableProps {
  data: Plan[];
  totalItems: number;
}

export function PlanTable({
  data,
  totalItems
}: PlanTableProps) {
  const [pageSize] = useQueryState('perPage', parseAsInteger.withDefault(10));

  const pageCount = Math.ceil(totalItems / pageSize);

  // Memoizar columnas para evitar re-renders innecesarios
  const memoizedColumns = useMemo(() => columns, []);

  const { table } = useDataTable({
    data,
    columns: memoizedColumns,
    pageCount: pageCount,
    shallow: false,
    debounceMs: 500
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
