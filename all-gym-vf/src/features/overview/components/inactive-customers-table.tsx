'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconBrandWhatsapp, IconUserOff, IconRefresh } from '@tabler/icons-react';
import type { InactiveCustomer } from '../actions/panel-actions';
import { CustomerWhatsAppDialog } from '@/features/customers/components/customer-tables/customer-whatsapp-dialog';
import type { CustomerWhatsApp } from '@/features/messages/whatsapp-helper';
import Link from 'next/link';

interface InactiveCustomersTableProps {
  data: InactiveCustomer[];
}

export function InactiveCustomersTable({ data }: InactiveCustomersTableProps) {
  const [whatsAppCustomer, setWhatsAppCustomer] = useState<CustomerWhatsApp | null>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getDaysInactiveBadge = (days: number) => {
    if (days <= 7) {
      return (
        <Badge variant='secondary' className='bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'>
          {days}d inactivo
        </Badge>
      );
    }
    if (days <= 30) {
      return (
        <Badge variant='secondary' className='bg-orange-500/20 text-orange-700 dark:text-orange-300'>
          {days}d inactivo
        </Badge>
      );
    }
    return (
      <Badge variant='destructive'>
        +{days}d inactivo
      </Badge>
    );
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <IconUserOff className='h-5 w-5 text-red-500' />
            <CardTitle className='text-lg font-semibold'>Clientes Inactivos</CardTitle>
          </div>
        </CardHeader>
        <CardContent className='flex h-[150px] items-center justify-center'>
          <p className='text-muted-foreground text-sm'>
            🎉 ¡Todos los clientes están activos!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className='border-red-500/20'>
      <CardHeader className='pb-3'>
        <div className='flex items-center gap-2'>
          <IconUserOff className='h-5 w-5 text-red-500' />
          <CardTitle className='text-lg font-semibold'>
            Clientes Inactivos
            <Badge variant='outline' className='ml-2 border-red-500/50 text-red-600'>
              {data.length}
            </Badge>
          </CardTitle>
        </div>
        <p className='text-sm text-muted-foreground'>Oportunidad de recuperación - Envíales una promo</p>
      </CardHeader>
      <CardContent>
        <ScrollArea className='h-[220px] pr-4'>
          <div className='space-y-3'>
            {data.map((customer) => (
              <div
                key={customer.user_id}
                className='flex items-center justify-between rounded-lg border border-red-500/10 bg-red-500/5 p-3'
              >
                <div className='flex items-center gap-3'>
                  <Avatar className='h-9 w-9 opacity-70'>
                    <AvatarImage src={customer.avatar_url || ''} alt={customer.user_name} />
                    <AvatarFallback className='bg-red-500/20 text-red-700 text-xs'>
                      {getInitials(customer.user_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium text-muted-foreground'>
                      {customer.user_name}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      Último: {customer.last_plan}
                    </span>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  {getDaysInactiveBadge(customer.days_inactive)}
                  {customer.phone && (
                    <Button
                      size='sm'
                      variant='outline'
                      className='h-8 w-8 p-0 border-emerald-500/50 hover:bg-emerald-500/10'
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setWhatsAppCustomer({
                          full_name: customer.user_name,
                          phone: customer.phone,
                          subscription_start_date: null,
                          subscription_end_date: customer.expired_date,
                          last_check_in: null,
                        });
                      }}
                    >
                      <IconBrandWhatsapp className='h-4 w-4 text-emerald-500' />
                    </Button>
                  )}
                  <Link href={`/panel/clientes?search=${encodeURIComponent(customer.user_name)}`}>
                    <Button 
                      size='sm' 
                      variant='ghost'
                      className='h-8 w-8 p-0'
                      title='Renovar suscripción'
                    >
                      <IconRefresh className='h-4 w-4' />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
      {whatsAppCustomer && (
        <CustomerWhatsAppDialog
          open={whatsAppCustomer !== null}
          onOpenChange={(open) => {
            if (!open) setWhatsAppCustomer(null);
          }}
          customer={whatsAppCustomer}
        />
      )}
    </>
  );
}
