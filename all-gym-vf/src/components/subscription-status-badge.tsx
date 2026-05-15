
import { Badge } from '@/components/ui/badge';
import { differenceInDays } from 'date-fns';

interface SubscriptionStatusBadgeProps {
  status: string | null | undefined;
  endDate: string | Date | null | undefined;
  className?: string;
}

export function SubscriptionStatusBadge({ status, endDate, className }: SubscriptionStatusBadgeProps) {
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

  // Calcular estado REAL basado en fecha de vencimiento
  if (endDate) {
    let parsedEndDate: Date;
    if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      const [year, month, day] = endDate.split('-').map(Number);
      parsedEndDate = new Date(year, month - 1, day);
    } else {
      parsedEndDate = new Date(endDate);
    }
    
    // Check if date is valid
    if (isNaN(parsedEndDate.getTime())) {
        if (status === 'active') {
            return <Badge variant="success" className={className}>Activo</Badge>;
        }
        return <Badge variant="outline" className={className}>Sin Plan</Badge>;
    }

    const daysLeft = differenceInDays(parsedEndDate, new Date());
    
    if (daysLeft < 0) {
      // VENCIDO - independientemente de lo que diga la BD
      badgeVariant = 'destructive';
      statusLabel = 'Vencido';
    } else if (daysLeft <= 3) {
      // Por vencer (próximos 3 días)
      badgeVariant = 'warning';
      statusLabel = 'Por Vencer';
    } else {
      // Activo
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
