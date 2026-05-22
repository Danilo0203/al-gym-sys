"use server";

import { createClient } from "@/lib/supabase/server";
import { isLocalAuthEnabled } from "@/lib/auth/local-auth-server";
import { runPaymentsPostedQueryCompat } from "@/lib/payments/schema-compat";
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays, addDays } from "date-fns";
import { es } from "date-fns/locale";

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
  id: number;
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

type MaybeRelation<T> = T | T[] | null;
type PlanRelation = MaybeRelation<{ name: string | null }>;

interface PlanDistributionRow {
  plans: PlanRelation;
}

interface RecentPaymentRow {
  id: number;
  user_id: string;
  amount_paid: number | string | null;
  method: RecentPayment["method"];
  payment_date: string;
  subscriptions: MaybeRelation<{
    plans: PlanRelation;
  }>;
  profiles: MaybeRelation<{
    full_name: string | null;
    avatar_url: string | null;
  }>;
}

interface SubscriptionCustomerRow {
  user_id: string;
  end_date: string;
  plans: PlanRelation;
  profiles: MaybeRelation<{
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
  }>;
}

function getRelationItem<T>(relation: MaybeRelation<T>) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

function getPlanName(planRelation: PlanRelation, fallback: string) {
  return getRelationItem(planRelation)?.name || fallback;
}

function getEmptyDashboardKPIs(): DashboardKPIs {
  return {
    totalRevenue: 0,
    revenueChange: 0,
    activeMembers: 0,
    inactiveMembers: 0,
    churnRate: 0,
    avgTicket: 0,
    cashAmount: 0,
    cardAmount: 0,
    transferAmount: 0,
  };
}

function getEmptyRevenueByMonth(): RevenueByMonth[] {
  return Array.from({ length: 6 }, (_, index) => ({
    month: format(subMonths(new Date(), 5 - index), "MMM", { locale: es }),
    revenue: 0,
  }));
}

function getEmptySubscriptionsFlow(): SubscriptionsFlow[] {
  return Array.from({ length: 6 }, (_, index) => ({
    month: format(subMonths(new Date(), 5 - index), "MMM", { locale: es }),
    newSubs: 0,
    cancelled: 0,
  }));
}

async function getDashboardSupabaseClient() {
  if (isLocalAuthEnabled()) {
    return null;
  }

  try {
    return await createClient();
  } catch (error) {
    console.error("Dashboard fallback activated:", error);
    return null;
  }
}

// ====================
// FUNCIONES PRINCIPALES
// ====================

export async function getDashboardKPIs(dateRange?: DashboardDateRange): Promise<DashboardKPIs> {
  const supabase = await getDashboardSupabaseClient();
  if (!supabase) return getEmptyDashboardKPIs();
  const now = new Date();

  // Usar el rango proporcionado o el mes actual por defecto
  const periodStart = dateRange?.from ? new Date(dateRange.from + "T00:00:00") : startOfMonth(now);
  const periodEnd = dateRange?.to ? new Date(dateRange.to + "T23:59:59") : endOfMonth(now);

  // Para comparativa, usar el período anterior equivalente
  const periodDuration = periodEnd.getTime() - periodStart.getTime();
  const prevPeriodEnd = new Date(periodStart.getTime() - 1);
  const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodDuration);

  // 1. Ingresos del período seleccionado
  const { data: currentPayments } = await runPaymentsPostedQueryCompat((usePostedFilter) => {
    let query = supabase
      .from("payments")
      .select("amount_paid, method")
      .gte("payment_date", periodStart.toISOString())
      .lte("payment_date", periodEnd.toISOString());

    if (usePostedFilter) {
      query = query.eq("status", "posted");
    }

    return query;
  });

  const totalRevenue = currentPayments?.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0;
  const cashAmount =
    currentPayments?.filter((p) => p.method === "cash").reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0;
  const cardAmount =
    currentPayments?.filter((p) => p.method === "card").reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0;
  const transferAmount =
    currentPayments?.filter((p) => p.method === "transfer").reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) ||
    0;

  // 2. Ingresos del período anterior (para comparativa)
  const { data: prevPeriodPayments } = await runPaymentsPostedQueryCompat((usePostedFilter) => {
    let query = supabase
      .from("payments")
      .select("amount_paid")
      .gte("payment_date", prevPeriodStart.toISOString())
      .lte("payment_date", prevPeriodEnd.toISOString());

    if (usePostedFilter) {
      query = query.eq("status", "posted");
    }

    return query;
  });

  const prevPeriodRevenue = prevPeriodPayments?.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0;
  const revenueChange =
    prevPeriodRevenue > 0 ? ((totalRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100 : totalRevenue > 0 ? 100 : 0;

  // 3. Miembros activos e inactivos (contar USUARIOS ÚNICOS, no suscripciones)
  // Un usuario es ACTIVO si tiene al menos 1 suscripción activa
  // Un usuario es INACTIVO si NO tiene ninguna suscripción activa

  // Obtener usuarios con suscripción activa (únicos)
  const { data: activeSubscriptions } = await supabase.from("subscriptions").select("user_id").eq("status", "active");

  const activeUserIds = new Set(activeSubscriptions?.map((s) => s.user_id) || []);
  const activeCount = activeUserIds.size;

  // Obtener todos los usuarios que tienen suscripciones (para calcular inactivos)
  const { data: allSubscriptions } = await supabase.from("subscriptions").select("user_id");

  const allUserIds = new Set(allSubscriptions?.map((s) => s.user_id) || []);

  // Usuarios inactivos = usuarios con suscripciones pero SIN ninguna activa
  const inactiveUserIds = Array.from(allUserIds).filter((id) => !activeUserIds.has(id));
  const inactiveCount = inactiveUserIds.length;

  // 4. Churn rate (usuarios que pasaron a inactivo en este período)
  // Contar usuarios ÚNICOS cuya última suscripción venció en el período Y no tienen otra activa
  const { data: churnedSubscriptions } = await supabase
    .from("subscriptions")
    .select("user_id")
    .in("status", ["expired", "cancelled"])
    .gte("end_date", periodStart.toISOString().split("T")[0])
    .lte("end_date", periodEnd.toISOString().split("T")[0]);

  // Filtrar solo usuarios que NO tienen suscripción activa (realmente "churnearon")
  const churnedUserIds = new Set(
    (churnedSubscriptions || []).filter((s) => !activeUserIds.has(s.user_id)).map((s) => s.user_id),
  );
  const churnedThisMonth = churnedUserIds.size;

  const totalMembers = activeCount + churnedThisMonth;
  const churnRate = totalMembers > 0 ? (churnedThisMonth / totalMembers) * 100 : 0;

  // 5. Ticket promedio
  const avgTicket = currentPayments && currentPayments.length > 0 ? totalRevenue / currentPayments.length : 0;

  return {
    totalRevenue,
    revenueChange: Math.round(revenueChange * 10) / 10,
    activeMembers: activeCount || 0,
    inactiveMembers: inactiveCount || 0,
    churnRate: Math.round(churnRate * 10) / 10,
    avgTicket: Math.round(avgTicket * 100) / 100,
    cashAmount,
    cardAmount,
    transferAmount,
  };
}

export async function getRevenueByMonth(): Promise<RevenueByMonth[]> {
  const supabase = await getDashboardSupabaseClient();
  if (!supabase) return getEmptyRevenueByMonth();
  const months: RevenueByMonth[] = [];

  for (let i = 5; i >= 0; i--) {
    const date = subMonths(new Date(), i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const { data } = await runPaymentsPostedQueryCompat((usePostedFilter) => {
      let query = supabase
        .from("payments")
        .select("amount_paid")
        .gte("payment_date", start.toISOString())
        .lte("payment_date", end.toISOString());

      if (usePostedFilter) {
        query = query.eq("status", "posted");
      }

      return query;
    });

    months.push({
      month: format(date, "MMM", { locale: es }),
      revenue: data?.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0,
    });
  }

  return months;
}

export async function getPlanDistribution(): Promise<PlanDistribution[]> {
  const supabase = await getDashboardSupabaseClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("subscriptions")
    .select(
      `
      plan_id,
      plans (name)
    `,
    )
    .eq("status", "active");

  if (!data || data.length === 0) return [];

  // Contar por plan
  const planCounts: Record<string, { name: string; count: number }> = {};

  (data as PlanDistributionRow[]).forEach((sub) => {
    const planName = getPlanName(sub.plans, "Sin Plan");
    if (!planCounts[planName]) {
      planCounts[planName] = { name: planName, count: 0 };
    }
    planCounts[planName].count++;
  });

  const total = data.length;
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return Object.values(planCounts).map((plan, index) => ({
    name: plan.name,
    count: plan.count,
    percentage: Math.round((plan.count / total) * 100),
    color: colors[index % colors.length],
  }));
}

export async function getRecentPayments(limit: number = 10): Promise<RecentPayment[]> {
  const supabase = await getDashboardSupabaseClient();
  if (!supabase) return [];

  const { data } = await runPaymentsPostedQueryCompat((usePostedFilter) => {
    let query = supabase
      .from("payments")
      .select(
        `
        id,
        user_id,
        amount_paid,
        method,
        payment_date,
        subscriptions!inner (
          plans (name)
        ),
        profiles!payments_user_id_fkey (
          full_name,
          avatar_url
        )
      `,
      )
      .order("payment_date", { ascending: false })
      .limit(limit);

    if (usePostedFilter) {
      query = query.eq("status", "posted");
    }

    return query;
  });

  if (!data) return [];

  return (data as RecentPaymentRow[]).map((payment) => {
    const paymentProfile = getRelationItem(payment.profiles);
    const paymentSubscription = getRelationItem(payment.subscriptions);

    return {
      id: payment.id,
      user_id: payment.user_id,
      user_name: paymentProfile?.full_name || "Usuario",
      avatar_url: paymentProfile?.avatar_url ?? null,
      plan_name: getPlanName(paymentSubscription?.plans ?? null, "Plan"),
      amount: Number(payment.amount_paid),
      method: payment.method,
      date: payment.payment_date,
    };
  });
}

export async function getExpiringSubscriptions(daysAhead: number = 5): Promise<ExpiringSubscription[]> {
  const supabase = await getDashboardSupabaseClient();
  if (!supabase) return [];
  const today = new Date();
  const futureDate = addDays(today, daysAhead);

  const { data } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      user_id,
      end_date,
      plans (name),
      profiles!subscriptions_user_id_fkey (
        full_name,
        avatar_url,
        phone
      )
    `,
    )
    .eq("status", "active")
    .gte("end_date", today.toISOString().split("T")[0])
    .lte("end_date", futureDate.toISOString().split("T")[0])
    .order("end_date", { ascending: true });

  if (!data) return [];

  return (data as SubscriptionCustomerRow[]).map((sub) => {
    const endDate = new Date(sub.end_date);
    const subscriptionProfile = getRelationItem(sub.profiles);

    return {
      user_id: sub.user_id,
      user_name: subscriptionProfile?.full_name || "Usuario",
      avatar_url: subscriptionProfile?.avatar_url ?? null,
      phone: subscriptionProfile?.phone ?? null,
      plan_name: getPlanName(sub.plans, "Plan"),
      end_date: sub.end_date,
      days_left: differenceInDays(endDate, today),
    };
  });
}

export async function getInactiveCustomers(limit: number = 10): Promise<InactiveCustomer[]> {
  const supabase = await getDashboardSupabaseClient();
  if (!supabase) return [];
  const today = new Date();

  const { data } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      user_id,
      end_date,
      plans (name),
      profiles!subscriptions_user_id_fkey (
        full_name,
        avatar_url,
        phone
      )
    `,
    )
    .in("status", ["expired", "cancelled"])
    .order("end_date", { ascending: false })
    .limit(limit);

  if (!data) return [];

  // Filtrar usuarios que no tienen una suscripción activa
  const uniqueUsers = new Map<string, InactiveCustomer>();

  for (const sub of data as SubscriptionCustomerRow[]) {
    if (!uniqueUsers.has(sub.user_id)) {
      // Verificar si tiene suscripción activa
      const { count } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", sub.user_id)
        .eq("status", "active");

      if (!count || count === 0) {
        const endDate = new Date(sub.end_date);
        const subscriptionProfile = getRelationItem(sub.profiles);

        uniqueUsers.set(sub.user_id, {
          user_id: sub.user_id,
          user_name: subscriptionProfile?.full_name || "Usuario",
          avatar_url: subscriptionProfile?.avatar_url ?? null,
          phone: subscriptionProfile?.phone ?? null,
          last_plan: getPlanName(sub.plans, "Plan"),
          expired_date: sub.end_date,
          days_inactive: differenceInDays(today, endDate),
        });
      }
    }
  }

  return Array.from(uniqueUsers.values()).slice(0, limit);
}

export async function getSubscriptionsFlow(): Promise<SubscriptionsFlow[]> {
  const supabase = await getDashboardSupabaseClient();
  if (!supabase) return getEmptySubscriptionsFlow();
  const flow: SubscriptionsFlow[] = [];

  for (let i = 5; i >= 0; i--) {
    const date = subMonths(new Date(), i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    // Nuevas suscripciones creadas este mes
    const { count: newCount } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    // Suscripciones que vencieron/cancelaron este mes
    const { count: cancelledCount } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .in("status", ["expired", "cancelled"])
      .gte("end_date", start.toISOString().split("T")[0])
      .lte("end_date", end.toISOString().split("T")[0]);

    flow.push({
      month: format(date, "MMM", { locale: es }),
      newSubs: newCount || 0,
      cancelled: cancelledCount || 0,
    });
  }

  return flow;
}

export async function getPaymentMethodDistribution(
  dateRange?: DashboardDateRange,
): Promise<PaymentMethodDistribution[]> {
  const supabase = await getDashboardSupabaseClient();
  if (!supabase) return [];
  const now = new Date();

  const periodStart = dateRange?.from ? new Date(dateRange.from + "T00:00:00") : startOfMonth(now);
  const periodEnd = dateRange?.to ? new Date(dateRange.to + "T23:59:59") : endOfMonth(now);

  const { data } = await runPaymentsPostedQueryCompat((usePostedFilter) => {
    let query = supabase
      .from("payments")
      .select("amount_paid, method")
      .gte("payment_date", periodStart.toISOString())
      .lte("payment_date", periodEnd.toISOString());

    if (usePostedFilter) {
      query = query.eq("status", "posted");
    }

    return query;
  });

  if (!data || data.length === 0) return [];

  const methodMap: Record<string, { amount: number; count: number }> = {
    cash: { amount: 0, count: 0 },
    card: { amount: 0, count: 0 },
    transfer: { amount: 0, count: 0 },
  };

  data.forEach((payment) => {
    const method = payment.method || "cash";
    if (methodMap[method]) {
      methodMap[method].amount += Number(payment.amount_paid || 0);
      methodMap[method].count++;
    }
  });

  const colors: Record<string, string> = {
    cash: "var(--success)",
    card: "var(--chart-1)",
    transfer: "var(--chart-4)",
  };

  const labels: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
  };

  return Object.entries(methodMap)
    .filter(([, data]) => data.count > 0)
    .map(([method, data]) => ({
      method: labels[method] || method,
      amount: data.amount,
      count: data.count,
      color: colors[method] || "hsl(var(--muted))",
    }));
}
