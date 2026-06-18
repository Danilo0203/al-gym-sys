'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconBrandWhatsapp, IconAlertTriangle } from '@tabler/icons-react';
import type { ExpiringSubscription } from '../actions/panel-actions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ExpiringSubscriptionsTableProps {
  data: ExpiringSubscription[];
}

export function ExpiringSubscriptionsTable({ data }: ExpiringSubscriptionsTableProps) {
  const router = useRouter();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getDaysLeftBadge = (daysLeft: number) => {
    if (daysLeft === 0) {
      return (
        <Badge variant='destructive' className='animate-pulse'>
          ¡Hoy!
        </Badge>
      );
    }
    if (daysLeft === 1) {
      return (
        <Badge variant='destructive'>
          Mañana
        </Badge>
      );
    }
    if (daysLeft <= 3) {
      return (
        <Badge variant='secondary' className='bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'>
          {daysLeft} días
        </Badge>
      );
    }
    return (
      <Badge variant='outline'>
        {daysLeft} días
      </Badge>
    );
  };

  const getWhatsAppLink = (phone: string | null, userName: string) => {
    if (!phone) return null;
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `¡Hola ${userName}! 👋 Te recordamos que tu membresía en el gimnasio está por vencer. ¿Te gustaría renovarla?`
    );
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <IconAlertTriangle className='h-5 w-5 text-yellow-500' />
            <CardTitle className='text-lg font-semibold'>Por Vencer</CardTitle>
          </div>
        </CardHeader>
        <CardContent className='flex h-[150px] items-center justify-center'>
          <p className='text-muted-foreground text-sm'>
            🎉 No hay suscripciones próximas a vencer
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='border-yellow-500/30'>
      <CardHeader className='pb-3'>
        <div className='flex items-center gap-2'>
          <IconAlertTriangle className='h-5 w-5 text-yellow-500' />
          <CardTitle className='text-lg font-semibold'>
            Por Vencer 
            <Badge variant='destructive' className='ml-2'>
              {data.length}
            </Badge>
          </CardTitle>
        </div>
        <p className='text-sm text-muted-foreground'>Próximos 5 días - Envíales un recordatorio</p>
      </CardHeader>
      <CardContent>
        <ScrollArea className='h-[220px] pr-4'>
          <div className='space-y-3'>
            {data.map((sub) => (
              <button
                key={sub.user_id}
                type='button'
                className='flex w-full items-center justify-between rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-left transition-colors hover:bg-yellow-500/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-yellow-500/50'
                onClick={() => router.push(`/panel/clientes/${sub.user_id}/history`)}
              >
                <div className='flex items-center gap-3'>
                  <Avatar className='h-9 w-9'>
                    <AvatarImage src={sub.avatar_url || ''} alt={sub.user_name} />
                    <AvatarFallback className='bg-yellow-500/20 text-yellow-700 text-xs'>
                      {getInitials(sub.user_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium'>{sub.user_name}</span>
                    <span className='text-xs text-muted-foreground'>{sub.plan_name}</span>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  {getDaysLeftBadge(sub.days_left)}
                  {sub.phone && getWhatsAppLink(sub.phone, sub.user_name) && (
                    <Link
                      href={getWhatsAppLink(sub.phone, sub.user_name)!}
                      target='_blank'
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button 
                        size='sm' 
                        variant='outline'
                        className='h-8 w-8 p-0 border-emerald-500/50 hover:bg-emerald-500/10'
                      >
                        <IconBrandWhatsapp className='h-4 w-4 text-emerald-500' />
                      </Button>
                    </Link>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
