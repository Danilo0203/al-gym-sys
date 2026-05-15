'use client';

import type { Column } from '@tanstack/react-table';
import { CalendarIcon, XCircle } from 'lucide-react';
import * as React from 'react';
import type { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { formatDate } from '@/lib/format';
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfDay,
  endOfDay,
  subDays
} from 'date-fns';
import { es } from 'date-fns/locale';

type DateSelection = Date[] | DateRange;

interface DatePreset {
  label: string;
  getValue: () => DateRange;
}

function getDatePresets(): DatePreset[] {
  const now = new Date();
  
  return [
    {
      label: 'Hoy',
      getValue: () => ({
        from: startOfDay(now),
        to: endOfDay(now)
      })
    },
    {
      label: 'Ayer',
      getValue: () => ({
        from: startOfDay(subDays(now, 1)),
        to: endOfDay(subDays(now, 1))
      })
    },
    {
      label: 'Últimos 7 días',
      getValue: () => ({
        from: startOfDay(subDays(now, 6)),
        to: endOfDay(now)
      })
    },
    {
      label: 'Esta semana',
      getValue: () => ({
        from: startOfWeek(now, { locale: es }),
        to: endOfWeek(now, { locale: es })
      })
    },
    {
      label: 'Semana pasada',
      getValue: () => {
        const lastWeek = subWeeks(now, 1);
        return {
          from: startOfWeek(lastWeek, { locale: es }),
          to: endOfWeek(lastWeek, { locale: es })
        };
      }
    },
    {
      label: 'Este mes',
      getValue: () => ({
        from: startOfMonth(now),
        to: endOfMonth(now)
      })
    },
    {
      label: 'Mes pasado',
      getValue: () => {
        const lastMonth = subMonths(now, 1);
        return {
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth)
        };
      }
    },
    {
      label: 'Últimos 30 días',
      getValue: () => ({
        from: startOfDay(subDays(now, 29)),
        to: endOfDay(now)
      })
    }
  ];
}

function getIsDateRange(value: DateSelection): value is DateRange {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function parseAsDate(timestamp: number | string | undefined): Date | undefined {
  if (!timestamp) return undefined;
  const numericTimestamp =
    typeof timestamp === 'string' ? Number(timestamp) : timestamp;
  const date = new Date(numericTimestamp);
  return !Number.isNaN(date.getTime()) ? date : undefined;
}

function parseColumnFilterValue(value: unknown) {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'number' || typeof item === 'string') {
        return item;
      }
      return undefined;
    });
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return [value];
  }

  return [];
}

interface DataTableDateFilterProps<TData> {
  column: Column<TData, unknown>;
  title?: string;
  multiple?: boolean;
}

export function DataTableDateFilter<TData>({
  column,
  title,
  multiple
}: DataTableDateFilterProps<TData>) {
  const columnFilterValue = column.getFilterValue();
  const presets = React.useMemo(() => getDatePresets(), []);

  const selectedDates = React.useMemo<DateSelection>(() => {
    if (!columnFilterValue) {
      return multiple ? { from: undefined, to: undefined } : [];
    }

    if (multiple) {
      const timestamps = parseColumnFilterValue(columnFilterValue);
      return {
        from: parseAsDate(timestamps[0]),
        to: parseAsDate(timestamps[1])
      };
    }

    const timestamps = parseColumnFilterValue(columnFilterValue);
    const date = parseAsDate(timestamps[0]);
    return date ? [date] : [];
  }, [columnFilterValue, multiple]);

  const onSelect = React.useCallback(
    (date: Date | DateRange | undefined) => {
      if (!date) {
        column.setFilterValue(undefined);
        return;
      }

      if (multiple && !('getTime' in date)) {
        const from = date.from?.getTime();
        const to = date.to?.getTime();
        column.setFilterValue(from || to ? [from, to] : undefined);
      } else if (!multiple && 'getTime' in date) {
        column.setFilterValue(date.getTime());
      }
    },
    [column, multiple]
  );

  const onPresetSelect = React.useCallback(
    (preset: DatePreset) => {
      const range = preset.getValue();
      const from = range.from?.getTime();
      const to = range.to?.getTime();
      column.setFilterValue(from || to ? [from, to] : undefined);
    },
    [column]
  );

  const onReset = React.useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      column.setFilterValue(undefined);
    },
    [column]
  );

  const hasValue = React.useMemo(() => {
    if (multiple) {
      if (!getIsDateRange(selectedDates)) return false;
      return selectedDates.from || selectedDates.to;
    }
    if (!Array.isArray(selectedDates)) return false;
    return selectedDates.length > 0;
  }, [multiple, selectedDates]);

  const formatDateRange = React.useCallback((range: DateRange) => {
    if (!range.from && !range.to) return '';
    if (range.from && range.to) {
      return `${formatDate(range.from)} - ${formatDate(range.to)}`;
    }
    return formatDate(range.from ?? range.to);
  }, []);

  const label = React.useMemo(() => {
    if (multiple) {
      if (!getIsDateRange(selectedDates)) return null;

      const hasSelectedDates = selectedDates.from || selectedDates.to;
      const dateText = hasSelectedDates
        ? formatDateRange(selectedDates)
        : 'Seleccionar rango';

      return (
        <span className='flex items-center gap-2'>
          <span>{title}</span>
          {hasSelectedDates && (
            <>
              <Separator
                orientation='vertical'
                className='mx-0.5 data-[orientation=vertical]:h-4'
              />
              <span>{dateText}</span>
            </>
          )}
        </span>
      );
    }

    if (getIsDateRange(selectedDates)) return null;

    const hasSelectedDate = selectedDates.length > 0;
    const dateText = hasSelectedDate
      ? formatDate(selectedDates[0])
      : 'Seleccionar fecha';

    return (
      <span className='flex items-center gap-2'>
        <span>{title}</span>
        {hasSelectedDate && (
          <>
            <Separator
              orientation='vertical'
              className='mx-0.5 data-[orientation=vertical]:h-4'
            />
            <span>{dateText}</span>
          </>
        )}
      </span>
    );
  }, [selectedDates, multiple, formatDateRange, title]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' className='border-dashed'>
          {hasValue ? (
            <div
              role='button'
              aria-label={`Clear ${title} filter`}
              tabIndex={0}
              onClick={onReset}
              className='focus-visible:ring-ring rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-1 focus-visible:outline-none'
            >
              <XCircle />
            </div>
          ) : (
            <CalendarIcon />
          )}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <div className='flex'>
          {/* Presets sidebar */}
          {multiple && (
            <div className='flex flex-col border-r p-2 min-w-[140px]'>
              <p className='text-xs font-medium text-muted-foreground mb-2 px-2'>
                Accesos rápidos
              </p>
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant='ghost'
                  size='sm'
                  className='justify-start font-normal text-xs h-8'
                  onClick={() => onPresetSelect(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}
          
          {/* Calendar */}
          <div>
            {multiple ? (
              <Calendar
                autoFocus
                mode='range'
                selected={
                  getIsDateRange(selectedDates)
                    ? selectedDates
                    : { from: undefined, to: undefined }
                }
                onSelect={onSelect}
                numberOfMonths={2}
                locale={es}
              />
            ) : (
              <Calendar
                autoFocus
                mode='single'
                selected={
                  !getIsDateRange(selectedDates) ? selectedDates[0] : undefined
                }
                onSelect={onSelect}
                locale={es}
              />
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
