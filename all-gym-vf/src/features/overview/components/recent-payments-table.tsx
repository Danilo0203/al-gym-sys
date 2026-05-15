'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconCash, IconCreditCard, IconArrowsExchange } from '@tabler/icons-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { RecentPayment } from '../actions/panel-actions';

interface RecentPaymentsTableProps {
  data: RecentPayment[];
}

export function RecentPaymentsTable({ data }: RecentPaymentsTableProps) {
  const formatCurrency = (amount: number) => {
    return `Q${amount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <IconCash className='h-4 w-4 text-emerald-500' />;
      case 'card':
        return <IconCreditCard className='h-4 w-4 text-blue-500' />;
      case 'transfer':
        return <IconArrowsExchange className='h-4 w-4 text-purple-500' />;
      default:
        return <IconCash className='h-4 w-4' />;
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Efectivo';
      case 'card':
        return 'Tarjeta';
      case 'transfer':
        return 'Transf.';
      default:
        return method;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (data.length === 0) {
    return (
      <Card className='col-span-4 md:col-span-3'>
        <CardHeader>
          <CardTitle className='text-lg font-semibold'>Pagos Recientes</CardTitle>
        </CardHeader>
        <CardContent className='flex h-[200px] items-center justify-center'>
          <p className='text-muted-foreground'>No hay pagos registrados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='col-span-4 md:col-span-3 h-full'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-lg font-semibold'>Pagos Recientes</CardTitle>
        <p className='text-sm text-muted-foreground'>Últimas transacciones recibidas</p>
      </CardHeader>
      <CardContent>
        <ScrollArea className='h-[300px] pr-4'>
          <div className='space-y-3'>
            {data.map((payment) => (
              <div
                key={payment.id}
                className='flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50'
              >
                <div className='flex items-center gap-3'>
                  <Avatar className='h-9 w-9'>
                    <AvatarImage src={payment.avatar_url || ''} alt={payment.user_name} />
                    <AvatarFallback className='bg-primary/10 text-primary text-xs'>
                      {getInitials(payment.user_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium'>{payment.user_name}</span>
                    <span className='text-xs text-muted-foreground'>{payment.plan_name}</span>
                  </div>
                </div>
                <div className='flex items-center gap-3'>
                  <Badge variant='outline' className='flex items-center gap-1'>
                    {getMethodIcon(payment.method)}
                    <span className='text-xs'>{getMethodLabel(payment.method)}</span>
                  </Badge>
                  <div className='text-right'>
                    <p className='text-sm font-semibold text-emerald-600'>
                      {formatCurrency(payment.amount)}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {format(new Date(payment.date), 'dd MMM HH:mm', { locale: es })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
