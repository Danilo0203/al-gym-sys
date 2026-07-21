import { cookies } from "next/headers";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { parseCustomerApiResponse } from "./local-customers";
import {
  customerHistoryResponseSchema,
  type CustomerHistoryResponse,
} from "./local-customer-history";

export async function serverGetCustomerHistory(
  customerId: string,
): Promise<CustomerHistoryResponse | null> {
  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  const response = await fetchAuthBackend(`/customers/${customerId}/history`, {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });

  if (response.status === 404) return null;

  return parseCustomerApiResponse(response, (payload) =>
    customerHistoryResponseSchema.parse(payload),
  );
}
