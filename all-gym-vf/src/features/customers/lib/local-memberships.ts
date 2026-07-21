"use client";

import { z } from "zod";

import { getAuthErrorMessage, parseJsonText } from "@/lib/auth/contracts";

export const planSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.coerce.number().nonnegative(),
  duration_days: z.number().int().positive(),
  is_active: z.boolean(),
});

export const membershipSchema = z.object({
  id: z.string().uuid(),
  plan_id: z.coerce.number().int().positive(),
  plan_name: z.string(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  grace_days: z.number().int().nonnegative(),
  access_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["active", "expired", "pending", "cancelled"]),
  display_status: z.enum(["active", "expiring", "grace", "expired", "cancelled", "none"]),
  cycles: z.number().int().positive(),
  price: z.coerce.number().nonnegative(),
  created_at: z.string(),
});

const plansResponseSchema = z.object({
  data: z.array(planSchema),
});

const customerMembershipResponseSchema = z.object({
  customer_id: z.string().uuid(),
  current_membership: membershipSchema.nullable(),
});

const membershipMutationResponseSchema = z.object({
  customer_id: z.string().uuid(),
  membership: membershipSchema,
  previous_membership_id: z.string().uuid().optional(),
});

const membershipWriteInputSchema = z.object({
  plan_id: z.number().int().positive(),
  cycles: z.number().int().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type Plan = z.infer<typeof planSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type MembershipWriteInput = z.infer<typeof membershipWriteInputSchema>;

export class MembershipApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MembershipApiError";
    this.status = status;
  }
}

async function fetchMembershipApi(pathname: string, init: RequestInit) {
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
    throw new MembershipApiError(
      `Backend local no disponible: ${error instanceof Error ? error.message : "Error desconocido"}`,
      503,
    );
  }

  if (response.status === 401) {
    window.location.replace("/iniciar-sesion");
    throw new MembershipApiError("Tu sesión expiró. Vuelve a iniciar sesión.", 401);
  }

  return response;
}

async function parseResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const responseText = await response.text();

  if (!response.ok) {
    let message = "No fue posible completar la operación de membresía.";

    if (responseText.trim()) {
      try {
        message = getAuthErrorMessage(parseJsonText(responseText, "Membership API")) ?? message;
      } catch {
        // Se conserva el mensaje seguro por defecto.
      }
    }

    throw new MembershipApiError(message, response.status);
  }

  return schema.parse(parseJsonText(responseText, "Membership API"));
}

export async function getPlans(): Promise<Plan[]> {
  const response = await fetchMembershipApi("/api/plans", { method: "GET" });
  const payload = await parseResponse(response, plansResponseSchema);
  return payload.data;
}

export async function getCustomerMembership(customerId: string): Promise<Membership | null> {
  const response = await fetchMembershipApi(`/api/customers/${customerId}/membership`, {
    method: "GET",
  });
  const payload = await parseResponse(response, customerMembershipResponseSchema);
  return payload.current_membership;
}

async function writeMembership(
  pathname: string,
  input: MembershipWriteInput,
) {
  const payload = membershipWriteInputSchema.parse(input);
  const response = await fetchMembershipApi(pathname, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseResponse(response, membershipMutationResponseSchema);
}

export function createMembershipForCustomer(customerId: string, input: MembershipWriteInput) {
  return writeMembership(`/api/customers/${customerId}/membership`, input);
}

export function renewMembershipForCustomer(customerId: string, input: MembershipWriteInput) {
  return writeMembership(`/api/customers/${customerId}/membership/renew`, input);
}

export async function cancelMembershipForCustomer(customerId: string) {
  const response = await fetchMembershipApi(`/api/customers/${customerId}/membership/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled" }),
  });
  return parseResponse(response, membershipMutationResponseSchema);
}
