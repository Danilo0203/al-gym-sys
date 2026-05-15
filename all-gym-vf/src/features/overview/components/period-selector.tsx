'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { useState, useCallback, useTransition } from 'react';
import { DateRange } from 'react-day-picker';

type PresetKey = 'week' | 'month' | 'last_month' | 'year' | 'custom';

interface Preset {
  key: PresetKey;
  label: string;
  getRange: () => { from: Date; to: Date };
}

const presets: Preset[] = [
  {
    key: 'week',
    label: 'Esta Semana',
    getRange: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    }),
  },
  {
    key: 'month',
    label: 'Este Mes',
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    key: 'last_month',
    label: 'Mes Anterior',
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  {
    key: 'year',
    label: 'Este Año',
    getRange: () => ({
      from: startOfYear(new Date()),
      to: endOfYear(new Date()),
    }),
  },
];

// Helper to parse date string without timezone issues
// By adding T12:00:00, we ensure the date stays on the correct day
function parseDateString(dateStr: string): Date {
  return parseISO(dateStr + 'T12:00:00');
}

interface DashboardPeriodSelectorProps {
  onLoadingChange?: (isLoading: boolean) => void;
}

export function DashboardPeriodSelector({ onLoadingChange }: DashboardPeriodSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  const currentPreset = (searchParams.get('period') as PresetKey) || 'month';
  const customFrom = searchParams.get('from');
  const customTo = searchParams.get('to');
  
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (currentPreset === 'custom' && customFrom && customTo) {
      return {
        from: parseDateString(customFrom),
        to: parseDateString(customTo),
      };
    }

    return undefined;
  });
  const [selectionCount, setSelectionCount] = useState(0);

  const handlePresetClick = useCallback((preset: Preset) => {
    const range = preset.getRange();
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', preset.key);
    params.set('from', format(range.from, 'yyyy-MM-dd'));
    params.set('to', format(range.to, 'yyyy-MM-dd'));
    
    onLoadingChange?.(true);
    startTransition(() => {
      router.push(`/panel/resumen?${params.toString()}`);
    });
  }, [router, searchParams, onLoadingChange]);

  // Handle date selection - track clicks and only close after 2nd selection
  const handleCustomDateSelect = useCallback((range: DateRange | undefined) => {
    setDateRange(range);
    
    if (range?.from && range?.to) {
      // Check if this is a real range (from and to are different days)
      // or if both from and to exist (user clicked twice)
      const isRealRange = !isSameDay(range.from, range.to);
      
      if (isRealRange) {
        // Navigate but keep open for live updates
        const params = new URLSearchParams(searchParams.toString());
        params.set('period', 'custom');
        params.set('from', format(range.from, 'yyyy-MM-dd'));
        params.set('to', format(range.to, 'yyyy-MM-dd'));
        
        onLoadingChange?.(true);
        startTransition(() => {
          router.push(`/panel/resumen?${params.toString()}`);
        });
        // setIsCustomOpen(false); // Removed to keep open
        setSelectionCount(0);
      } else {
        // Same day selected - user just started, increment count
        const newCount = selectionCount + 1;
        setSelectionCount(newCount);
        
        // If user clicks same day twice, treat it as a single-day range
        if (newCount >= 2) {
          const params = new URLSearchParams(searchParams.toString());
          params.set('period', 'custom');
          params.set('from', format(range.from, 'yyyy-MM-dd'));
          params.set('to', format(range.to, 'yyyy-MM-dd'));
          
          onLoadingChange?.(true);
          startTransition(() => {
            router.push(`/panel/resumen?${params.toString()}`);
          });
          // setIsCustomOpen(false); // Removed to keep open
          setSelectionCount(0);
        }
      }
    } else if (range?.from && !range?.to) {
      // First date selected, keep popover open
      setSelectionCount(1);
    }
  }, [router, searchParams, onLoadingChange, selectionCount]);

  // Format the custom date range for display
  const getCustomLabel = () => {
    if (currentPreset === 'custom' && customFrom && customTo) {
      const from = parseDateString(customFrom);
      const to = parseDateString(customTo);
      return `${format(from, 'dd MMM', { locale: es })} - ${format(to, 'dd MMM yyyy', { locale: es })}`;
    }
    return 'Período...';
  };

  // Reset dateRange when opening popover if not in custom mode
  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      // Reset selection state when opening
      setSelectionCount(0);
      if (currentPreset !== 'custom') {
        setDateRange(undefined);
      }
    }
    setIsCustomOpen(open);
  }, [currentPreset]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.key}
          variant={currentPreset === preset.key ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetClick(preset)}
          disabled={isPending}
          className={cn(
            'h-8 text-xs font-medium transition-all',
            currentPreset === preset.key && 'shadow-sm',
            isPending && 'opacity-70'
          )}
        >
          {preset.label}
        </Button>
      ))}
      
      {/* Custom Date Range Picker */}
      <Popover open={isCustomOpen} onOpenChange={handleOpenChange} modal={false}>
        <PopoverTrigger asChild>
          <Button
            variant={currentPreset === 'custom' ? 'default' : 'outline'}
            size="sm"
            disabled={isPending}
            className={cn(
              'h-8 text-xs font-medium transition-all gap-1.5',
              currentPreset === 'custom' && 'shadow-sm',
              isPending && 'opacity-70'
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {getCustomLabel()}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0" 
          align="end"
          sideOffset={8}
        >
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from || new Date()}
            selected={dateRange}
            onSelect={handleCustomDateSelect}
            numberOfMonths={2}
            locale={es}
          />
          {/* Helper text */}
          <div className="px-4 pb-3 pt-1 text-xs text-muted-foreground text-center border-t">
            {dateRange?.from && !dateRange?.to 
              ? 'Ahora selecciona la fecha de fin'
              : dateRange?.from && dateRange?.to && isSameDay(dateRange.from, dateRange.to)
                ? 'Selecciona otra fecha o haz clic de nuevo para un solo día'
                : 'Haz clic para seleccionar la fecha de inicio'}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
