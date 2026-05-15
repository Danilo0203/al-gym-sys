'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Plan } from '../../actions/plan-actions';
import { CellAction } from './cell-action';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';

export const columns: ColumnDef<Plan>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="NOMBRE" />
    ),
    enableColumnFilter: true,
    meta: {
      label: 'Buscar por nombre...',
      placeholder: 'Buscar por nombre...',
      variant: 'text' as const,
    },
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>
  },
  {
    id: 'price',
    accessorKey: 'price',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="PRECIO" />
    ),
    cell: ({ row }) => (
      <span className="font-medium text-primary">
        Q{row.original.price.toFixed(2)}
      </span>
    )
  },
  {
    id: 'duration_days',
    accessorKey: 'duration_days',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="DURACIÓN" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.duration_days} días
      </span>
    )
  },
  {
    id: 'is_active',
    accessorKey: 'is_active',
    header: 'ESTADO',
    enableColumnFilter: true,
    meta: {
      label: 'Estado',
      variant: 'select' as const,
      options: [
        { label: 'Activo', value: 'true' },
        { label: 'Inactivo', value: 'false' },
      ],
    },
    filterFn: (row, id, filterValue) => {
      if (!filterValue || filterValue.length === 0) return true;
      const isActive = row.getValue(id);
      return filterValue.includes(String(isActive));
    },
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? 'default' : 'secondary'}>
        {row.original.is_active ? 'Activo' : 'Inactivo'}
      </Badge>
    )
  },
  {
    id: 'actions',
    header: 'Acciones',
    cell: ({ row }) => <CellAction data={row.original} />
  }
];
