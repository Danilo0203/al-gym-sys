"use server";

import {
  getLocalDashboardOverview,
  type LocalDashboardOverviewPayload,
} from "@/features/overview/server/local-dashboard";

// ====================
// TIPOS
// ====================
export interface DashboardKPIs {
  totalRevenue: number;
  revenueChange: number;
  activeMembers: number;
  inactiveMembers: number;
  churnRate: number;
  avgTicket: number;
  cashAmount: number;
  cardAmount: number;
  transferAmount: number;
}

export interface RevenueByMonth extends Record<string, string | number> {
  month: string;
  revenue: number;
}

export interface PlanDistribution extends Record<string, string | number> {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface RecentPayment {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  plan_name: string;
  amount: number;
  method: "cash" | "card" | "transfer";
  date: string;
}

export interface ExpiringSubscription {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  phone: string | null;
  plan_name: string;
  end_date: string;
  days_left: number;
}

export interface InactiveCustomer {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  phone: string | null;
  last_plan: string;
  expired_date: string;
  days_inactive: number;
}

export interface SubscriptionsFlow extends Record<string, string | number> {
  month: string;
  newSubs: number;
  cancelled: number;
}

export interface PaymentMethodDistribution extends Record<string, string | number> {
  method: string;
  amount: number;
  count: number;
  color: string;
}

// Interfaz para rango de fechas del dashboard
export interface DashboardDateRange {
  from: string; // ISO date string (YYYY-MM-DD)
  to: string; // ISO date string (YYYY-MM-DD)
}

function getDateRangeArgs(dateRange?: DashboardDateRange) {
  if (dateRange?.from && dateRange?.to) {
    return {
      from: dateRange.from,
      to: dateRange.to,
    };
  }

  return {};
}

async function getOverviewPayload(dateRange?: DashboardDateRange) {
  const { from, to } = getDateRangeArgs(dateRange);
  return getLocalDashboardOverview(from, to);
}

function getSection<T>(payload: LocalDashboardOverviewPayload, ...keys: string[]): T {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined) {
      return value as T;
    }
  }

  throw new Error(
    `Local dashboard payload is missing section "${keys[0]}". Available keys: ${Object.keys(payload).join(", ") || "none"}.`,
  );
}

function getArraySection<T>(payload: LocalDashboardOverviewPayload, ...keys: string[]): T[] {
  const section = getSection<unknown>(payload, ...keys);

  if (!Array.isArray(section)) {
    throw new Error(`Local dashboard section "${keys[0]}" is not an array.`);
  }

  return section as T[];
}

function getObjectSection<T>(payload: LocalDashboardOverviewPayload, ...keys: string[]): T {
  const section = getSection<unknown>(payload, ...keys);

  if (!section || typeof section !== "object" || Array.isArray(section)) {
    throw new Error(`Local dashboard section "${keys[0]}" is not an object.`);
  }

  return section as T;
}

// ====================
// FUNCIONES PRINCIPALES
// ====================

export async function getDashboardKPIs(dateRange?: DashboardDateRange): Promise<DashboardKPIs> {
  const payload = await getOverviewPayload(dateRange);
  return getObjectSection<DashboardKPIs>(payload, "kpis", "dashboardKPIs");
}

export async function getRevenueByMonth(): Promise<RevenueByMonth[]> {
  const payload = await getOverviewPayload();
  return getArraySection<RevenueByMonth>(payload, "revenueByMonth", "revenue_by_month");
}

export async function getPlanDistribution(): Promise<PlanDistribution[]> {
  const payload = await getOverviewPayload();
  return getArraySection<PlanDistribution>(payload, "planDistribution", "plan_distribution");
}

export async function getRecentPayments(limit: number = 10): Promise<RecentPayment[]> {
  const payload = await getOverviewPayload();
  return getArraySection<RecentPayment>(payload, "recentPayments", "recent_payments").slice(0, limit);
}

export async function getExpiringSubscriptions(daysAhead: number = 5): Promise<ExpiringSubscription[]> {
  const payload = await getOverviewPayload();
  return getArraySection<ExpiringSubscription>(payload, "expiringSubscriptions", "expiring_subscriptions").filter(
    (subscription) => subscription.days_left <= daysAhead,
  );
}

export async function getInactiveCustomers(limit: number = 10): Promise<InactiveCustomer[]> {
  const payload = await getOverviewPayload();
  return getArraySection<InactiveCustomer>(payload, "inactiveCustomers", "inactive_customers").slice(0, limit);
}

export async function getSubscriptionsFlow(): Promise<SubscriptionsFlow[]> {
  const payload = await getOverviewPayload();
  return getArraySection<SubscriptionsFlow>(payload, "subscriptionsFlow", "subscriptions_flow");
}

export async function getPaymentMethodDistribution(
  dateRange?: DashboardDateRange,
): Promise<PaymentMethodDistribution[]> {
  const payload = await getOverviewPayload(dateRange);
  return getArraySection<PaymentMethodDistribution>(
    payload,
    "paymentMethodDistribution",
    "payment_method_distribution",
  );
}
