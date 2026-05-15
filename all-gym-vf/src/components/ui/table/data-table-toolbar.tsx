'use client';

import type {
  Column,
  ColumnFiltersState,
  SortingState,
  Table
} from '@tanstack/react-table';
import * as React from 'react';
import { ListFilter, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { DataTableDateFilter } from '@/components/ui/table/data-table-date-filter';
import { DataTableFacetedFilter } from '@/components/ui/table/data-table-faceted-filter';
import { DataTableSliderFilter } from '@/components/ui/table/data-table-slider-filter';
import { DataTableViewOptions } from '@/components/ui/table/data-table-view-options';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Cross2Icon } from '@radix-ui/react-icons';
import type { Option } from '@/types/data-table';

interface DataTableToolbarProps<TData> extends React.ComponentProps<'div'> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
  children,
  className,
  ...props
}: DataTableToolbarProps<TData>) {
  const columnFilters = table.getState().columnFilters;
  const sorting = table.getState().sorting;
  const defaultSorting = React.useMemo(
    () => table.initialState.sorting ?? [],
    [table]
  );
  const hasActiveSorting = !areSortingStatesEqual(sorting, defaultSorting);
  const hasActiveState = columnFilters.length > 0 || hasActiveSorting;

  const columns = React.useMemo(
    () => table.getAllColumns().filter((column) => column.getCanFilter()),
    [table]
  );

  const onReset = React.useCallback(() => {
    table.resetColumnFilters();
    table.resetSorting();
    table.setPageIndex(0);
  }, [table]);

  const activeItems = React.useMemo(
    () => getActiveToolbarItems(table, columnFilters, sorting, defaultSorting),
    [columnFilters, defaultSorting, sorting, table]
  );

  return (
    <div className={cn('flex w-full flex-col gap-2 p-1', className)} {...props}>
      <div
        role='toolbar'
        aria-orientation='horizontal'
        className='flex w-full items-start justify-between gap-2'
      >
        <div className='flex flex-1 flex-wrap items-center gap-2'>
          {columns.map((column) => (
            <DataTableToolbarFilter key={column.id} column={column} />
          ))}
          {hasActiveState && (
            <>
              <ActiveFiltersPopover items={activeItems} />
              <Button
                aria-label='Restablecer filtros y orden'
                variant='outline'
                size='sm'
                className='border-dashed'
                onClick={onReset}
              >
                <Cross2Icon />
                Restablecer todo
              </Button>
            </>
          )}
        </div>
        <div className='flex items-center gap-2'>
          {children}
          <DataTableViewOptions table={table} />
        </div>
      </div>

    </div>
  );
}

interface DataTableToolbarFilterProps<TData> {
  column: Column<TData>;
}

function DataTableToolbarFilter<TData>({
  column
}: DataTableToolbarFilterProps<TData>) {
  {
    const columnMeta = column.columnDef.meta;

    const onFilterRender = React.useCallback(() => {
      if (!columnMeta?.variant) return null;

      switch (columnMeta.variant) {
        case 'text':
          return (
            <Input
              placeholder={columnMeta.placeholder ?? columnMeta.label}
              value={(column.getFilterValue() as string) ?? ''}
              onChange={(event) => column.setFilterValue(event.target.value)}
              className='h-8 w-40 lg:w-56'
            />
          );

        case 'number':
          return (
            <div className='relative'>
              <Input
                type='number'
                inputMode='numeric'
                placeholder={columnMeta.placeholder ?? columnMeta.label}
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(event) => column.setFilterValue(event.target.value)}
                className={cn('h-8 w-[120px]', columnMeta.unit && 'pr-8')}
              />
              {columnMeta.unit && (
                <span className='bg-accent text-muted-foreground absolute top-0 right-0 bottom-0 flex items-center rounded-r-md px-2 text-sm'>
                  {columnMeta.unit}
                </span>
              )}
            </div>
          );

        case 'range':
          return (
            <DataTableSliderFilter
              column={column}
              title={columnMeta.label ?? column.id}
            />
          );

        case 'date':
        case 'dateRange':
          return (
            <DataTableDateFilter
              column={column}
              title={columnMeta.label ?? column.id}
              multiple={columnMeta.variant === 'dateRange'}
            />
          );

        case 'select':
        case 'multiSelect':
          return (
            <DataTableFacetedFilter
              column={column}
              title={columnMeta.label ?? column.id}
              options={columnMeta.options ?? []}
              multiple={columnMeta.variant === 'multiSelect'}
            />
          );

        default:
          return null;
      }
    }, [column, columnMeta]);

    return onFilterRender();
  }
}

interface ActiveToolbarItem {
  id: string;
  label: string;
  onRemove: () => void;
}

function ActiveFiltersPopover({
  items
}: {
  items: ActiveToolbarItem[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' className='border-dashed'>
          <ListFilter />
          Filtros activos
          <Badge variant='secondary' className='rounded-sm px-1 font-normal'>
            {items.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-80 space-y-3'>
        <div>
          <div>
            <p className='text-sm font-medium'>Filtros y orden activos</p>
            <p className='text-muted-foreground text-xs'>
              Quita uno individualmente desde esta lista.
            </p>
          </div>
        </div>
        <div className='flex max-h-72 flex-wrap gap-2 overflow-y-auto'>
          {items.map((item) => (
            <Badge
              key={item.id}
              variant='outline'
              className='bg-background flex items-center gap-1 rounded-md px-2 py-1'
            >
              <span>{item.label}</span>
              <button
                type='button'
                aria-label={`Quitar ${item.label}`}
                onClick={item.onRemove}
                className='hover:text-foreground text-muted-foreground rounded-sm'
              >
                <X className='size-3' />
              </button>
            </Badge>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function getActiveToolbarItems<TData>(
  table: Table<TData>,
  columnFilters: ColumnFiltersState,
  sorting: SortingState,
  defaultSorting: SortingState
): ActiveToolbarItem[] {
  const filterItems = columnFilters.flatMap((filter) => {
    const column = table.getColumn(filter.id);
    if (!column) return [];

    const columnLabel = column.columnDef.meta?.label ?? filter.id;
    const filterLabel = getFilterValueLabel(
      filter.value,
      column.columnDef.meta?.options
    );

    return [
      {
        id: `filter-${filter.id}`,
        label: `${columnLabel}: ${filterLabel}`,
        onRemove: () => column.setFilterValue(undefined)
      }
    ];
  });

  const sortingItems = areSortingStatesEqual(sorting, defaultSorting)
    ? []
    : sorting.map((sortItem) => {
    const column = table.getColumn(sortItem.id);
    const columnLabel = column?.columnDef.meta?.label ?? sortItem.id;
    const directionLabel = sortItem.desc ? 'descendente' : 'ascendente';

    return {
      id: `sort-${sortItem.id}`,
      label: `Orden: ${columnLabel} ${directionLabel}`,
      onRemove: () =>
        table.setSorting((current) =>
          current.filter((item) => item.id !== sortItem.id)
        )
    };
    });

  return [...filterItems, ...sortingItems];
}

function areSortingStatesEqual(
  currentSorting: SortingState,
  defaultSorting: SortingState
) {
  if (currentSorting.length !== defaultSorting.length) {
    return false;
  }

  return currentSorting.every((currentItem, index) => {
    const defaultItem = defaultSorting[index];
    return (
      defaultItem &&
      currentItem.id === defaultItem.id &&
      currentItem.desc === defaultItem.desc
    );
  });
}

function getFilterValueLabel(
  value: unknown,
  options?: Option[]
): string {
  const optionLabelMap = new Map(
    (options ?? []).map((option) => [option.value, option.label])
  );

  if (Array.isArray(value)) {
    return value
      .map((item) => optionLabelMap.get(String(item)) ?? String(item))
      .join(', ');
  }

  if (value == null || value === '') {
    return 'Sin valor';
  }

  return optionLabelMap.get(String(value)) ?? String(value);
}
