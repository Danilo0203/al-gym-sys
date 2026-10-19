import { addDays, addMonths } from "date-fns";

export function calculateSubscriptionEndDate(startDate: Date, planDurationDays: number): Date {
  return planDurationDays >= 30 && planDurationDays <= 31
    ? addMonths(startDate, 1)
    : addDays(startDate, planDurationDays);
}

export function calculateAutomaticRenewalPeriod(
  previousStart: Date,
  previousEnd: Date,
  planDurationDays: number,
  today: Date,
): { from: Date; to: Date } {
  if (planDurationDays >= 30 && planDurationDays <= 31) {
    // El cobro usa el mes actual, pero conserva el día del alta original.
    const monthsSinceStart = (today.getFullYear() - previousStart.getFullYear()) * 12
      + today.getMonth() - previousStart.getMonth();
    const cycle = Math.max(1, monthsSinceStart);
    return {
      from: addMonths(previousStart, cycle),
      to: addMonths(previousStart, cycle + 1),
    };
  }

  let from = previousEnd;
  let to = addDays(from, planDurationDays);
  while (to <= today) {
    from = to;
    to = addDays(from, planDurationDays);
  }
  return { from, to };
}
