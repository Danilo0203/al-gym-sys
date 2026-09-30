"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import type { ExtendedColumnSort } from "@/types/data-table";
import type { Payment } from "../components/payment-tables/columns";

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

const paymentSchema = z.object({
  id: z.string().uuid(),
  payment_date: z.string().datetime(),
  amount_paid: z.number(),
  method: z.enum(["cash", "card", "transfer"]),
  user_id: z.string().uuid(),
  user_name: z.string(),
  avatar_url: z.string().nullable(),
  plan_name: z.string(),
  subscription_status: z.string().nullable(),
  subscription_end_date: z.string().nullable(),
  subscription_grace_days: z.number().nullable(),
  subscription_access_until: z.string().nullable(),
});

const paymentsResponseSchema = z.object({
  data: z.array(paymentSchema),
  total: z.number().int().nonnegative(),
});

const sortableColumns = new Set([
  "payment_date", "user_name", "subscription_status", "plan_name", "method", "amount_paid",
]);

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
  if (!access.isAuthenticated) throw new Error("No autenticado");
  if (!hasPermission(access, "payments.view")) {
    throw new Error("No autorizado: Se requiere permiso payments.view");
  }

  const query = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  if (user_name) query.set("user_name", user_name);
  if (method) query.set("method", method);
  if (subscription_status) query.set("subscription_status", subscription_status);

  if (payment_date) {
    const [start, end] = payment_date.split(",");
    const startTimestamp = Number(start);
    if (start && Number.isFinite(startTimestamp) && !Number.isNaN(new Date(startTimestamp).getTime())) {
      query.set("payment_date_start", new Date(startTimestamp).toISOString());
    }
    const endTimestamp = Number(end);
    if (end && Number.isFinite(endTimestamp) && !Number.isNaN(new Date(endTimestamp).getTime())) {
      const endDate = new Date(endTimestamp);
      endDate.setHours(23, 59, 59, 999);
      query.set("payment_date_end", endDate.toISOString());
    }
  }

  const validSort = sort?.filter((entry) => sortableColumns.has(entry.id));
  if (validSort?.length) {
    query.set("sort", validSort.map((entry) => `${entry.id}:${entry.desc ? "desc" : "asc"}`).join(","));
  }

  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  const response = await fetchAuthBackend(`/payments?${query.toString()}`, {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  if (!response.ok) throw new Error("Error al cargar pagos");
  return paymentsResponseSchema.parse(await response.json());
}
