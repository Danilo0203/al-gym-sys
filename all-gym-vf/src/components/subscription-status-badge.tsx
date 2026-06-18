
import { Badge } from '@/components/ui/badge';
import { getSubscriptionDisplayStatus, type SubscriptionDisplayStatus } from '@/lib/subscriptions/display-status';

interface SubscriptionStatusBadgeProps {
  status: string | null | undefined;
  endDate: string | Date | null | undefined;
  graceDays?: number | null;
  accessUntil?: string | Date | null;
  displayStatus?: SubscriptionDisplayStatus | string | null;
  className?: string;
}

export function SubscriptionStatusBadge({
  status,
  endDate,
  graceDays,
  accessUntil,
  displayStatus,
  className,
}: SubscriptionStatusBadgeProps) {
  let badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' = 'outline';
  let statusLabel = 'Sin Plan';
  const resolvedDisplayStatus =
    displayStatus === "active" ||
    displayStatus === "expiring" ||
    displayStatus === "grace" ||
    displayStatus === "expired" ||
    displayStatus === "cancelled" ||
    displayStatus === "none"
      ? displayStatus
      : getSubscriptionDisplayStatus({ status, endDate, graceDays, accessUntil });

  if (resolvedDisplayStatus === 'none' || resolvedDisplayStatus === 'cancelled') {
    if (resolvedDisplayStatus === 'cancelled') {
      badgeVariant = 'destructive';
      statusLabel = 'Cancelado';
    }
    return <Badge variant={badgeVariant} className={className}>{statusLabel}</Badge>;
  }

  switch (resolvedDisplayStatus) {
    case 'expired':
      badgeVariant = 'destructive';
      statusLabel = 'Vencido';
      break;
    case 'grace':
      badgeVariant = 'warning';
      statusLabel = 'En Prórroga';
      break;
    case 'expiring':
      badgeVariant = 'warning';
      statusLabel = 'Por Vencer';
      break;
    case 'active':
    default:
      badgeVariant = 'success';
      statusLabel = 'Activo';
      break;
  }

  return <Badge variant={badgeVariant} className={className}>{statusLabel}</Badge>;
}
