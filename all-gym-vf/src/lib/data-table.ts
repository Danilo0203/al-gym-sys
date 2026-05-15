import type {
  ExtendedColumnFilter,
  FilterOperator,
  FilterVariant
} from '@/types/data-table';
import type { Column } from '@tanstack/react-table';

import { dataTableConfig } from '@/config/data-table';

export function getCommonPinningStyles<TData>({
  column,
  withBorder = false,
  backgroundColor
}: {
  column: Column<TData>;
  withBorder?: boolean;
  backgroundColor?: string;
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === 'left' && column.getIsLastColumn('left');
  const isFirstRightPinnedColumn =
    isPinned === 'right' && column.getIsFirstColumn('right');

  return {
    boxShadow: withBorder
      ? isLastLeftPinnedColumn
        ? '1px 0 0 0 var(--border) inset, 10px 0 18px -14px rgb(0 0 0 / 0.32)'
        : isFirstRightPinnedColumn
          ? '-1px 0 0 0 var(--border) inset, -10px 0 18px -14px rgb(0 0 0 / 0.32)'
          : undefined
      : undefined,
    left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
    right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    position: isPinned ? 'sticky' : 'relative',
    backgroundColor: isPinned ? backgroundColor : undefined,
    backgroundClip: isPinned ? 'padding-box' : undefined,
    minWidth: column.getSize(),
    width: column.getSize(),
    maxWidth: column.getSize(),
    overflow: 'hidden',
    isolation: isPinned ? 'isolate' : undefined,
    zIndex: isPinned ? 20 : 0
  };
}

export function getFilterOperators(filterVariant: FilterVariant) {
  const operatorMap: Record<
    FilterVariant,
    { label: string; value: FilterOperator }[]
  > = {
    text: dataTableConfig.textOperators,
    number: dataTableConfig.numericOperators,
    range: dataTableConfig.numericOperators,
    date: dataTableConfig.dateOperators,
    dateRange: dataTableConfig.dateOperators,
    boolean: dataTableConfig.booleanOperators,
    select: dataTableConfig.selectOperators,
    multiSelect: dataTableConfig.multiSelectOperators
  };

  return operatorMap[filterVariant] ?? dataTableConfig.textOperators;
}

export function getDefaultFilterOperator(filterVariant: FilterVariant) {
  const operators = getFilterOperators(filterVariant);

  return operators[0]?.value ?? (filterVariant === 'text' ? 'iLike' : 'eq');
}

export function getValidFilters<TData>(
  filters: ExtendedColumnFilter<TData>[]
): ExtendedColumnFilter<TData>[] {
  return filters.filter(
    (filter) =>
      filter.operator === 'isEmpty' ||
      filter.operator === 'isNotEmpty' ||
      (Array.isArray(filter.value)
        ? filter.value.length > 0
        : filter.value !== '' &&
          filter.value !== null &&
          filter.value !== undefined)
  );
}
