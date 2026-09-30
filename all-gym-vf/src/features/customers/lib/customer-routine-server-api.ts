import { cookies } from "next/headers";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import type { CustomerRoutineWorkspace } from "@/lib/training/types";
import { parseCustomerApiResponse } from "./local-customers";
import { parseCustomerRoutineWorkspace } from "./local-customer-routine";

export async function serverGetCustomerRoutineWorkspace(
  customerId: string,
): Promise<CustomerRoutineWorkspace | null> {
  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  const response = await fetchAuthBackend(`/customers/${customerId}/routine`, {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });

  if (response.status === 404) return null;

  return parseCustomerApiResponse(response, parseCustomerRoutineWorkspace);
}
