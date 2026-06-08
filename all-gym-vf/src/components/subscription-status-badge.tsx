
import { Badge } from '@/components/ui/badge';
import { differenceInCalendarDays } from 'date-fns';
import { getSubscriptionAccessUntilDate, parseLocalDate } from '@/lib/subscriptions/grace-period';

interface SubscriptionStatusBadgeProps {
  status: string | null | undefined;
  endDate: string | Date | null | undefined;
  graceDays?: number | null;
  accessUntil?: string | Date | null;
  className?: string;
}

export function SubscriptionStatusBadge({ status, endDate, graceDays, accessUntil, className }: SubscriptionStatusBadgeProps) {
  let badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' = 'outline';
  let statusLabel = 'Sin Plan';

  // Si no hay plan o status
  if (!status || status === 'cancelled') {
    if (status === 'cancelled') {
      badgeVariant = 'destructive';
      statusLabel = 'Cancelado';
    }
    return <Badge variant={badgeVariant} className={className}>{statusLabel}</Badge>;
  }

  // Calcular estado REAL basado en fecha de vencimiento y prórroga.
  if (endDate) {
    const parsedEndDate = parseLocalDate(endDate);
    const parsedAccessUntil = accessUntil
      ? parseLocalDate(accessUntil)
      : getSubscriptionAccessUntilDate(endDate, graceDays ?? 0);
    const today = parseLocalDate(new Date());

    if (!parsedEndDate || !parsedAccessUntil || !today) {
      if (status === 'active') {
        return <Badge variant="success" className={className}>Activo</Badge>;
      }
      return <Badge variant="outline" className={className}>Sin Plan</Badge>;
    }

    const daysToEnd = differenceInCalendarDays(parsedEndDate, today);
    const isInGracePeriod = parsedEndDate < today && parsedAccessUntil >= today;

    if (parsedAccessUntil < today) {
      badgeVariant = 'destructive';
      statusLabel = 'Vencido';
    } else if (isInGracePeriod) {
      badgeVariant = 'warning';
      statusLabel = 'En Prórroga';
    } else if (daysToEnd <= 3) {
      badgeVariant = 'warning';
      statusLabel = 'Por Vencer';
    } else {
      badgeVariant = 'success';
      statusLabel = 'Activo';
    }
  } else if (status === 'active') {
    // Sin fecha pero marcado como activo
    badgeVariant = 'success';
    statusLabel = 'Activo';
  } else if (status === 'expired') {
    badgeVariant = 'destructive';
    statusLabel = 'Vencido';
  }

  return <Badge variant={badgeVariant} className={className}>{statusLabel}</Badge>;
}
