"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { parseCustomerApiResponse } from "@/features/customers/lib/local-customers";
import { enrollmentStateSchema, type EnrollmentQuote } from "./enrollment-types";

async function call(path: string, method = "GET", body?: unknown) {
  const cookie = buildCookieHeader((await cookies()).getAll());
  const response = await fetchAuthBackend(`/enrollment${path}`, {
    method, headers: { ...(cookie && { cookie }), "content-type": "application/json" }, cache: "no-store",
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  return parseCustomerApiResponse(response, (payload) => payload);
}
function refresh(customerId?: string) {
  for (const path of ["/panel/caja", "/panel/caja/historial", "/panel/pagos", "/panel/resumen", "/panel/clientes", "/panel/planes"]) revalidatePath(path);
  if (customerId) revalidatePath(`/panel/clientes/${customerId}`);
}
export async function getEnrollment(customerId?: string) {
  return enrollmentStateSchema.parse(await call(customerId ? `/${z.uuid().parse(customerId)}` : "/settings"));
}
export async function updateEnrollmentFee(fee: number) {
  const state = enrollmentStateSchema.parse(await call("/settings", "PUT", { fee }));
  refresh();
  return state;
}
export async function reviewEnrollment(customerId: string, year: number, status: "pending" | "recognized", reason: string) {
  const state = enrollmentStateSchema.parse(await call(`/${z.uuid().parse(customerId)}/review`, "POST", { year, status, reason }));
  refresh(customerId);
  return state;
}
export async function collectEnrollment(customerId: string, quote: EnrollmentQuote, paymentMethod: "cash" | "card" | "transfer") {
  const result = z.object({ enrollment: enrollmentStateSchema }).parse(
    await call(`/${z.uuid().parse(customerId)}/collect`, "POST", { ...quote, paymentMethod }));
  refresh(customerId);
  return result.enrollment;
}
