import { fetchAuthBackend } from "@/lib/auth/backend-auth";
import { cookies } from "next/headers";

export interface CreateMembershipInput {
  plan_id: number;
  cycles: number;
  start_date?: string;
}

export interface RenewMembershipInput {
  plan_id: number;
  cycles: number;
  start_date?: string;
}

export interface CancelMembershipInput {
  status: "cancelled" | "active";
}

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return headers;
}

export async function serverGetCustomerMembership(customerId: string) {
  const headers = await getAuthHeaders();
  const response = await fetchAuthBackend(`/customers/${customerId}/membership`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const errText = await response.text();
    throw new Error(`Failed to get membership: ${errText}`);
  }

  return response.json();
}

export async function serverCreateMembership(customerId: string, data: CreateMembershipInput) {
  const headers = await getAuthHeaders();
  const response = await fetchAuthBackend(`/customers/${customerId}/membership`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to create membership: ${errText}`);
  }

  return response.json();
}

export async function serverRenewMembership(customerId: string, data: RenewMembershipInput) {
  const headers = await getAuthHeaders();
  const response = await fetchAuthBackend(`/customers/${customerId}/membership/renew`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to renew membership: ${errText}`);
  }

  return response.json();
}

export async function serverUpdateMembershipStatus(customerId: string, status: CancelMembershipInput["status"]) {
  const headers = await getAuthHeaders();
  const response = await fetchAuthBackend(`/customers/${customerId}/membership/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status } satisfies CancelMembershipInput),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to update membership status: ${errText}`);
  }

  return response.json();
}
