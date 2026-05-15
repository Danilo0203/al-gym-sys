"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { Payment } from "../components/payment-tables/columns";
import type { ExtendedColumnSort } from "@/types/data-table";

export interface GetPaymentsParams {
  page: number;
  perPage: number;
  user_name?: string | null;
  method?: string | null;
  payment_date?: string | null;
  subscription_status?: string | null;
  sort?: ExtendedColumnSort<Payment>[] | null;
}

export interface GetPaymentsResponse {
  data: Payment[];
  total: number;
}

interface PaymentRow {
  id: string;
  payment_date: string;
  amount_paid: number | string;
  method: Payment["method"];
  user_id: string;
  user_name: string | null;
  avatar_url: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  subscription_end_date: string | null;
}

export async function getPayments({
  page,
  perPage,
  user_name,
  method,
  payment_date,
  subscription_status,
  sort,
}: GetPaymentsParams): Promise<GetPaymentsResponse> {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    throw new Error("No autenticado");
  }
  if (!hasPermission(access, "payments.view")) {
    throw new Error("No autorizado: Se requiere permiso payments.view");
  }

  const supabase = await createClient();
  let query = supabase.from("payments_overview").select("*", { count: "exact" });

  // Apply text filters
  if (user_name) {
    query = query.ilike("user_name", `%${user_name}%`);
  }

  // Apply subscription status filter
  if (subscription_status) {
    const statuses = subscription_status.split(",").filter(Boolean);
    if (statuses.length > 0) {
      query = query.in("subscription_status", statuses);
    }
  }

  // Apply method filter (multi-select)
  if (method) {
    const methods = method.split(",").filter(Boolean);
    if (methods.length > 0) {
      query = query.in("method", methods);
    }
  }

  // Apply date range filter
  if (payment_date) {
    const dates = payment_date.split(",").filter(Boolean);
    if (dates.length >= 1 && dates[0]) {
      const startTimestamp = parseInt(dates[0], 10);
      if (!isNaN(startTimestamp)) {
        const startDate = new Date(startTimestamp);
        query = query.gte("payment_date", startDate.toISOString());
      }
    }
    if (dates.length >= 2 && dates[1]) {
      const endTimestamp = parseInt(dates[1], 10);
      if (!isNaN(endTimestamp)) {
        const endDate = new Date(endTimestamp);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte("payment_date", endDate.toISOString());
      }
    }
  }

  // Pagination
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Sorting logic
  if (sort && sort.length > 0) {
    const sortColumnMap: Partial<Record<string, keyof PaymentRow>> = {
      payment_date: "payment_date",
      user_name: "user_name",
      subscription_status: "subscription_status",
      plan_name: "plan_name",
      method: "method",
      amount_paid: "amount_paid",
    };
    let hasAppliedSort = false;

    sort.forEach((s) => {
      const column = sortColumnMap[s.id];
      if (column) {
        query = query.order(column, { ascending: !s.desc, nullsFirst: false });
        hasAppliedSort = true;
      }
    });

    if (!hasAppliedSort) {
      query = query.order("payment_date", { ascending: false });
    }
  } else {
    query = query.order("payment_date", { ascending: false });
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching payments:", error);
    throw new Error("Error al cargar pagos");
  }

  const payments: Payment[] = ((data || []) as PaymentRow[]).map((p) => {
    return {
      id: p.id,
      payment_date: p.payment_date,
      amount_paid: Number(p.amount_paid),
      method: p.method,
      user_id: p.user_id,
      user_name: p.user_name || "Usuario eliminado",
      avatar_url: p.avatar_url,
      plan_name: p.plan_name || "Sin plan",
      subscription_status: p.subscription_status,
      subscription_end_date: p.subscription_end_date,
    };
  });

  return {
    data: payments,
    total: count || 0,
  };
}
