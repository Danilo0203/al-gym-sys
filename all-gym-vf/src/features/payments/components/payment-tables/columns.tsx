'use client';

import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { SubscriptionStatusBadge } from '@/components/subscription-status-badge';

export interface Payment {
  id: string;
  payment_date: string;
  amount_paid: number;
  method: 'cash' | 'card' | 'transfer';
  user_name: string;
  user_email?: string;
  avatar_url?: string | null;
  plan_name: string;
  user_id: string;
  subscription_status?: string | null;
  subscription_end_date?: string | null;
  subscription_grace_days?: number | null;
  subscription_access_until?: string | null;
}

export interface MethodOption {
  label: string;
  value: string;
}

const methodLabels: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

const methodColors: Record<string, string> = {
  cash: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  card: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  transfer: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
};

// Default method options
const defaultMethodOptions: MethodOption[] = [
  { label: 'Efectivo', value: 'cash' },
  { label: 'Tarjeta', value: 'card' },
  { label: 'Transferencia', value: 'transfer' }
];

// Status options
const statusOptions: MethodOption[] = [
  { label: 'Activo', value: 'active' },
  { label: 'Vencido', value: 'expired' },
  { label: 'Cancelado', value: 'cancelled' }
];

// Factory function to create columns with dynamic options
export function getColumns(methodOptions: MethodOption[] = defaultMethodOptions): ColumnDef<Payment>[] {
  return [
    {
      id: 'payment_date',
      accessorKey: 'payment_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="FECHA" />
      ),
      enableColumnFilter: true,
      meta: {
        label: 'Fecha',
        variant: 'dateRange' as const
      },
      cell: ({ row }) => {
        const date = new Date(row.original.payment_date);
        return (
          <span className='whitespace-nowrap font-medium'>
            {format(date, 'dd MMM yyyy, HH:mm', { locale: es })}
          </span>
        );
      }
    },
    {
      id: 'user_name',
      accessorKey: 'user_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="CLIENTE" />
      ),
      enableColumnFilter: true,
      meta: {
        label: 'Cliente',
        placeholder: 'Buscar cliente...',
        variant: 'text' as const
      },
      cell: ({ row }) => {
        const name = row.original.user_name || 'Desconocido';
        const avatar = row.original.avatar_url;
        const initials = name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();

        return (
          <div className='flex items-center gap-2'>
            <Avatar className='h-8 w-8 text-[10px]'>
              <AvatarImage src={avatar || ''} alt={name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className='flex flex-col gap-0.5'>
              <span className='font-medium text-sm leading-none'>{name}</span>
              {row.original.user_email && (
                <span className='text-[10px] text-muted-foreground'>
                  {row.original.user_email}
                </span>
              )}
              
            </div>
          </div>
        );
      }
    },
    {
      id: 'subscription_status',
      accessorKey: 'subscription_status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ESTADO" />
      ),
      enableColumnFilter: true,
      meta: {
        label: 'Estado',
        variant: 'select' as const,
        options: statusOptions
      },
      cell: ({ row }) => (
        <SubscriptionStatusBadge 
          status={row.original.subscription_status} 
          endDate={row.original.subscription_end_date}
          graceDays={row.original.subscription_grace_days}
          accessUntil={row.original.subscription_access_until}
        />
      ),
    },
    {
      accessorKey: 'plan_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="SUSCRIPCIÓN" />
      ),
      cell: ({ row }) => (
        <Badge variant='outline' className='whitespace-nowrap font-normal border-muted-foreground/30 text-muted-foreground'>
          {row.original.plan_name}
        </Badge>
      ),
      meta: {
        label: 'Plan',
      }
    },
    {
      id: 'method',
      accessorKey: 'method',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="MÉTODO" />
      ),
      enableColumnFilter: true,
      meta: {
        label: 'Método de pago',
        variant: 'select' as const,
        options: methodOptions
      },
      cell: ({ row }) => {
        const method = row.original.method || 'cash';
        return (
          <Badge
            className={`whitespace-nowrap font-normal ${methodColors[method] || 'bg-gray-100 text-gray-800'}`}
            variant='secondary'
          >
            {methodLabels[method] || method}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'amount_paid',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="MONTO" />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('amount_paid'));
        return <div className='font-bold text-base'>Q{amount.toFixed(2)}</div>;
      }
    }
  ];
}

// Export static columns for backward compatibility
export const columns = getColumns();
