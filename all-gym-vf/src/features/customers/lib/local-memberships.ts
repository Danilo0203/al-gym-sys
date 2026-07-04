import { z } from "zod";

export const planSchema = z.object({
  id: z.coerce.string(),
  name: z.string(),
  price: z.coerce.number(),
  duration_days: z.number().nullable(),
  is_active: z.boolean(),
  description: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

export const membershipSchema = z.object({
  id: z.string().uuid(),
  plan_id: z.coerce.number(),
  plan_name: z.string(),
  grace_days: z.coerce.number(),
  access_until: z.string(),
  status: z.string(),
  display_status: z.enum(["active", "expiring", "grace", "expired", "cancelled", "none"]),
  start_date: z.string(),
  end_date: z.string(),
  cycles: z.number(),
  price: z.number(),
  created_at: z.string(),
});

const customerMembershipResponseSchema = z.object({
  customer_id: z.string().uuid(),
  current_membership: membershipSchema.nullable(),
  latest_memberships: z.array(membershipSchema),
});

const membershipMutationResponseSchema = z.object({
  customer_id: z.string().uuid(),
  membership: membershipSchema,
});

const membershipStatusInputSchema = z.object({
  status: z.enum(["cancelled", "active"]),
});

const membershipWriteInputSchema = z.object({
  plan_id: z.number().int().positive(),
  cycles: z.number().int().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type Plan = z.infer<typeof planSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type CustomerMembershipResponse = z.infer<typeof customerMembershipResponseSchema>;
export type MembershipMutationResponse = z.infer<typeof membershipMutationResponseSchema>;
export type MembershipWriteInput = z.infer<typeof membershipWriteInputSchema>;
export type MembershipStatusInput = z.infer<typeof membershipStatusInputSchema>;

type LegacyCompatibleMembershipWriteInput = {
  plan_id: number;
  cycles?: number;
  start_date?: string;
  end_date?: string;
  price?: number;
};

function inferCyclesFromLegacyWindow(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) {
    return 1;
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diffMs = end.getTime() - start.getTime();

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return 1;
  }

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.ceil(diffDays / 30));
}

export async function getPlans(): Promise<Plan[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/plans`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch plans: ${response.statusText}`);
    }

    const data = await response.json();
    return z.array(planSchema).parse(data);
  } catch (error) {
    console.error("Error in local-memberships getPlans:", error);
    return [];
  }
}

export async function getPlansFromServer(): Promise<Plan[]> {
  try {
    const { cookies } = await import("next/headers");
    const { fetchAuthBackend } = await import("@/lib/auth/backend-auth");

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const headers = new Headers();
    if (cookieHeader) headers.set("cookie", cookieHeader);
    const response = await fetchAuthBackend("/plans", {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch plans: ${response.statusText}`);
    }

    const data = await response.json();
    return z.array(planSchema).parse(data);
  } catch (error) {
    console.error("Error in local-memberships getPlansFromServer:", error);
    return [];
  }
}

export async function getCustomerMembership(customerId: string): Promise<Membership | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/customers/${customerId}/membership`, {
      method: "GET",
      cache: "no-store",
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch membership: ${response.statusText}`);
    }

    const data = await response.json();
    return customerMembershipResponseSchema.parse(data).current_membership;
  } catch (error) {
    console.error("Error in local-memberships getCustomerMembership:", error);
    return null;
  }
}

export async function createOrUpdateMembershipFromServer(
  customerId: string,
  data: LegacyCompatibleMembershipWriteInput,
): Promise<MembershipMutationResponse> {
  const { fetchAuthBackend } = await import("@/lib/auth/backend-auth");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (cookieHeader) headers.set("cookie", cookieHeader);
  const payload = membershipWriteInputSchema.parse({
    plan_id: data.plan_id,
    cycles: data.cycles ?? inferCyclesFromLegacyWindow(data.start_date, data.end_date),
    start_date: data.start_date,
  });

  const response = await fetchAuthBackend(`/customers/${customerId}/membership`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to save membership: ${errText}`);
  }

  return membershipMutationResponseSchema.parse(await response.json());
}

export async function createMembershipForCustomer(
  customerId: string,
  data: MembershipWriteInput,
): Promise<MembershipMutationResponse> {
  const payload = membershipWriteInputSchema.parse(data);
  const response = await fetch(`/api/customers/${customerId}/membership`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return membershipMutationResponseSchema.parse(await response.json());
}

export async function renewMembershipForCustomer(
  customerId: string,
  data: MembershipWriteInput,
): Promise<MembershipMutationResponse> {
  const payload = membershipWriteInputSchema.parse(data);
  const response = await fetch(`/api/customers/${customerId}/membership/renew`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return membershipMutationResponseSchema.parse(await response.json());
}

export async function updateMembershipStatusForCustomer(
  customerId: string,
  status: MembershipStatusInput["status"],
): Promise<MembershipMutationResponse> {
  const payload = membershipStatusInputSchema.parse({ status });
  const response = await fetch(`/api/customers/${customerId}/membership/status`, {
    method: "PATCH",
    credentials: "include",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return membershipMutationResponseSchema.parse(await response.json());
}
