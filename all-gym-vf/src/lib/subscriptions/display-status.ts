import { differenceInCalendarDays } from "date-fns";
import { getSubscriptionAccessUntilDate, parseLocalDate } from "@/lib/subscriptions/grace-period";

export type SubscriptionDisplayStatus =
  | "active"
  | "expiring"
  | "grace"
  | "expired"
  | "cancelled"
  | "none";

interface SubscriptionDisplayStatusParams {
  status: string | null | undefined;
  endDate: string | Date | null | undefined;
  graceDays?: number | null;
  accessUntil?: string | Date | null;
}

export function getSubscriptionDisplayStatus({
  status,
  endDate,
  graceDays,
  accessUntil,
}: SubscriptionDisplayStatusParams): SubscriptionDisplayStatus {
  if (!status) return "none";
  if (status === "cancelled") return "cancelled";

  if (endDate) {
    const parsedEndDate = parseLocalDate(endDate);
    const parsedAccessUntil = accessUntil
      ? parseLocalDate(accessUntil)
      : getSubscriptionAccessUntilDate(endDate, graceDays ?? 0);
    const today = parseLocalDate(new Date());

    if (parsedEndDate && parsedAccessUntil && today) {
      const daysToEnd = differenceInCalendarDays(parsedEndDate, today);
      const isInGracePeriod = parsedEndDate < today && parsedAccessUntil >= today;

      if (parsedAccessUntil < today) return "expired";
      if (isInGracePeriod) return "grace";
      if (daysToEnd <= 3) return "expiring";
      return "active";
    }
  }

  if (status === "expired") return "expired";
  if (status === "active") return "active";
  return "none";
}
