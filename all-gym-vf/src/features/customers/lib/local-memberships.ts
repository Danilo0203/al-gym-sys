import { z } from "zod";
import { CustomerApiError, parseCustomerApiResponse } from "./local-customers";

export const planSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.coerce.number().nonnegative(),
  duration_days: z.number().int().positive(),
  is_active: z.boolean(),
});

export const plansListResponseSchema = z.object({
  data: z.array(planSchema),
});

export const membershipSchema = z.object({
  id: z.uuid(),
  plan_id: z.coerce.number().int().positive(),
  plan_name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  grace_days: z.coerce.number().int(),
  access_until: z.string(),
  status: z.string(),
  display_status: z.enum(["active", "expiring", "grace", "expired", "cancelled", "none"]),
  cycles: z.coerce.number().int().positive(),
  price: z.coerce.number().nonnegative(),
  created_at: z.string(),
});

export const customerMembershipResponseSchema = z.object({
  customer_id: z.uuid(),
  current_membership: membershipSchema.nullable(),
});

export const membershipMutationResponseSchema = z.object({
  customer_id: z.uuid(),
  membership: membershipSchema,
  previous_membership_id: z.uuid().optional(),
});

export const membershipWriteInputSchema = z.object({
  plan_id: z.number().int().positive(),
  cycles: z.number().int().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

export const cancelMembershipInputSchema = z.object({
  status: z.literal("cancelled"),
}).strict();

export type Plan = z.infer<typeof planSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type MembershipWriteInput = z.infer<typeof membershipWriteInputSchema>;
export type MembershipMutationResponse = z.infer<typeof membershipMutationResponseSchema>;

async function fetchMembershipApi(pathname: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(pathname, {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    throw new CustomerApiError(
      `Backend local no disponible: ${error instanceof Error ? error.message : "Error desconocido"}`,
      503,
    );
  }

  if (response.status === 401) {
    window.location.replace("/iniciar-sesion");
    throw new CustomerApiError("Tu sesión expiró. Vuelve a iniciar sesión.", 401);
  }
  return response;
}

export async function getPlans(): Promise<Plan[]> {
  const response = await fetchMembershipApi("/api/plans", { method: "GET" });
  const parsed = await parseCustomerApiResponse(response, (value) => plansListResponseSchema.parse(value));
  return parsed.data;
}

export async function getCustomerMembership(customerId: string): Promise<Membership | null> {
  const response = await fetchMembershipApi(`/api/customers/${customerId}/membership`, { method: "GET" });
  const parsed = await parseCustomerApiResponse(response, (value) => customerMembershipResponseSchema.parse(value));
  return parsed.current_membership;
}

async function mutateMembership(
  pathname: string,
  method: "POST" | "PATCH",
  input: unknown,
): Promise<MembershipMutationResponse> {
  const response = await fetchMembershipApi(pathname, {
    method,
    body: JSON.stringify(input),
  });
  return parseCustomerApiResponse(response, (value) => membershipMutationResponseSchema.parse(value));
}

export function createMembershipForCustomer(customerId: string, input: MembershipWriteInput) {
  const payload = membershipWriteInputSchema.parse(input);
  return mutateMembership(`/api/customers/${customerId}/membership`, "POST", payload);
}

export function renewMembershipForCustomer(customerId: string, input: MembershipWriteInput) {
  const payload = membershipWriteInputSchema.parse(input);
  return mutateMembership(`/api/customers/${customerId}/membership/renew`, "POST", payload);
}

export function cancelMembershipForCustomer(customerId: string) {
  const payload = cancelMembershipInputSchema.parse({ status: "cancelled" });
  return mutateMembership(`/api/customers/${customerId}/membership/status`, "PATCH", payload);
}
