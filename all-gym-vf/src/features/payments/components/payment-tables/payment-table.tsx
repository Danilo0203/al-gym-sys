'use client';

import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { getColumns, Payment, MethodOption } from './columns';
import { parseAsInteger, useQueryState } from 'nuqs';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { useMemo } from 'react';

// 1. Importamos ExcelJS y FileSaver
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface PaymentTableProps {
  data: Payment[];
  totalItems: number;
  methodOptions?: MethodOption[];
}

export function PaymentTable({
  data,
  totalItems,
  methodOptions = []
}: PaymentTableProps) {
  const [pageSize] = useQueryState('perPage', parseAsInteger.withDefault(10));
  const pageCount = Math.ceil(totalItems / pageSize);

  const columns = useMemo(() => getColumns(methodOptions), [methodOptions]);

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    shallow: false,
    debounceMs: 500,
    initialState: {
      columnVisibility: {
        subscription_status: false
      }
    }
  });

  // 2. Nueva lógica de exportación asíncrona
  const handleExport = async () => {
    try {
      // Crear un nuevo libro de trabajo
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Pagos');

      // Definir las columnas (header = título visible, key = clave interna)
      worksheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 20 },
        { header: 'Cliente', key: 'cliente', width: 30 },
        { header: 'Plan', key: 'plan', width: 20 },
        { header: 'Método', key: 'metodo', width: 15 },
        { header: 'Monto', key: 'monto', width: 15 },
      ];

      // Mapear los datos y agregarlos como filas
      const exportData = data.map(p => ({
        fecha: format(new Date(p.payment_date), 'yyyy-MM-dd HH:mm'),
        cliente: p.user_name,
        plan: p.plan_name,
        metodo: p.method,
        monto: p.amount_paid // Asumiendo que es número, Excel lo tratará como tal
      }));

      worksheet.addRows(exportData);

      // (Opcional) Dar formato de negrita a la primera fila (encabezados)
      worksheet.getRow(1).font = { bold: true };

      // Generar el buffer y descargar
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      saveAs(blob, `pagos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
    } catch (error) {
      console.error("Error al exportar Excel:", error);
    }
  };

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table}>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExport}
          className="ml-auto flex h-8 gap-2 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200" 
        >
          <Download className="h-4 w-4" />
          Exportar Excel
        </Button>
      </DataTableToolbar>
    </DataTable>
  );
}
