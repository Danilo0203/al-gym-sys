"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { customerDetailSchema, parseCustomerApiResponse } from "@/features/customers/lib/local-customers";
import type {
  CreateCustomerData,
  RenewSubscriptionData,
} from "@/features/customers/actions/customer-actions";
import {
  buildCashCustomerCreatePayload,
  buildCashCustomerRenewalPayload,
} from "@/features/cash/lib/local-customer-intake";
import { registerLocalCustomerOnClock } from "@/features/cash/lib/local-device-sync";

async function cashMutation(path: string, payload: unknown) {
  const cookieHeader = buildCookieHeader((await cookies()).getAll());
  const headers = new Headers({ "content-type": "application/json" });
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return fetchAuthBackend(path, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

function refreshCashViews(customerId?: string) {
  revalidatePath("/panel/clientes");
  if (customerId) revalidatePath(`/panel/clientes/${customerId}`);
  revalidatePath("/panel/resumen");
  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
}

export async function createCashCustomer(data: CreateCustomerData) {
  const payload = buildCashCustomerCreatePayload(data);
  const response = await cashMutation("/customers", payload);
  const customer = await parseCustomerApiResponse(response, (body) => customerDetailSchema.parse(body));
  refreshCashViews(customer.id);
  return { deviceSync: await registerLocalCustomerOnClock(customer.id) };
}

export async function renewCashCustomer(customerId: string, data: RenewSubscriptionData) {
  try {
    const payload = buildCashCustomerRenewalPayload(customerId, data);
    const response = await cashMutation("/payments/membership", payload);
    await parseCustomerApiResponse(response, (body) => body);
    refreshCashViews(customerId);
    return { success: true, deviceSync: await registerLocalCustomerOnClock(customerId) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo renovar la membresía",
    };
  }
}
