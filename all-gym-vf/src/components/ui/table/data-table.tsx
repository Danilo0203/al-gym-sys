import { type Table as TanstackTable, flexRender } from "@tanstack/react-table";
import type * as React from "react";

import { DataTablePagination } from "@/components/ui/table/data-table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCommonPinningStyles } from "@/lib/data-table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> extends React.ComponentProps<"div"> {
  table: TanstackTable<TData>;
  actionBar?: React.ReactNode;
  onRowClick?: (data: TData) => void;
}

export function DataTable<TData>({
  table,
  actionBar,
  onRowClick,
  children,
  getRowClassName,
}: DataTableProps<TData> & { getRowClassName?: (data: TData) => string }) {
  const visibleColumns = table.getVisibleLeafColumns();

  return (
    <div className="flex flex-1 flex-col space-y-4">
      {children}
      <div className="relative flex flex-1">
        <div className="absolute inset-0 flex overflow-hidden rounded-lg border">
          <Table
            className="min-w-full w-max table-fixed border-separate border-spacing-0"
            style={{ width: table.getTotalSize() }}
          >
            <colgroup>
              {visibleColumns.map((column) => (
                <col
                  key={column.id}
                  style={{
                    width: column.getSize(),
                    minWidth: column.getSize(),
                  }}
                />
              ))}
            </colgroup>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        header.column.getIsPinned() && "bg-muted relative"
                      )}
                      style={{
                        ...getCommonPinningStyles({
                          column: header.column,
                          withBorder: true,
                          backgroundColor: "var(--muted)",
                        }),
                        zIndex: header.column.getIsPinned() ? 30 : 10,
                      }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest('td[data-disable-row-click="true"]')) {
                        return;
                      }
                      onRowClick?.(row.original);
                    }}
                    className={`${onRowClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""} ${getRowClassName ? getRowClassName(row.original) : ""}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        data-disable-row-click={
                          (cell.column.columnDef.meta as { disableRowClick?: boolean } | undefined)
                            ?.disableRowClick
                            ? "true"
                            : undefined
                        }
                        className={cn(
                          cell.column.getIsPinned() &&
                            "bg-background relative"
                        )}
                        style={{
                          ...getCommonPinningStyles({
                            column: cell.column,
                            withBorder: true,
                            backgroundColor: "var(--background)",
                          }),
                          zIndex: cell.column.getIsPinned() ? 20 : 0,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={table.getAllColumns().length} className="h-24 text-center">
                    Sin resultados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <DataTablePagination table={table} />
        {actionBar && table.getFilteredSelectedRowModel().rows.length > 0 && actionBar}
      </div>
    </div>
  );
}
