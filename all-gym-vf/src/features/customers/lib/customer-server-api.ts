/**
 * customer-server-api.ts
 *
 * Server-side API layer for the Customers module.
 * Used by Server Actions and SSR components.
 * Centralizes all communication with the local backend via fetchAuthBackend.
 * No "use client" — safe to import in Server Components and Server Actions.
 */

import { cookies } from "next/headers";
import { fetchAuthBackend } from "@/lib/auth/backend-auth";
import {
  CustomerApiError,
  customerDetailSchema,
  parseCustomerListResponse,
  parseCustomerApiResponse,
  parseCustomerDetailResponse,
  type CustomerListResponse,
  type CreateCustomerInput,
  type CustomerDetail,
  type CustomerListSort,
  type UpdateCustomerInput,
} from "./local-customers";

async function buildServerCookieHeaders(): Promise<Headers> {
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

export async function serverGetCustomerById(id: string): Promise<CustomerDetail | null> {
  const headers = await buildServerCookieHeaders();
  const response = await fetchAuthBackend(`/customers/${id}`, {
    method: "GET",
    headers,
  });

  if (response.status === 404) {
    return null;
  }

  return parseCustomerApiResponse(response, parseCustomerDetailResponse);
}

export async function serverGetCustomersList(params?: {
  page?: number;
  pageSize?: number;
  search?: string | null;
  sort?: CustomerListSort;
  isActive?: boolean;
}): Promise<CustomerListResponse> {
  const headers = await buildServerCookieHeaders();
  const searchParams = new URLSearchParams();

  searchParams.set("page", String(params?.page ?? 1));
  searchParams.set("page_size", String(params?.pageSize ?? 20));

  if (params?.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }

  if (params?.sort) {
    searchParams.set("sort", params.sort);
  }

  if (params?.isActive !== undefined) {
    searchParams.set("is_active", params.isActive ? "true" : "false");
  }

  const response = await fetchAuthBackend(`/customers?${searchParams.toString()}`, {
    method: "GET",
    headers,
  });

  return parseCustomerApiResponse(response, parseCustomerListResponse);
}

export async function serverCreateCustomer(input: CreateCustomerInput): Promise<CustomerDetail> {
  const headers = await buildServerCookieHeaders();
  const response = await fetchAuthBackend("/customers", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  return parseCustomerApiResponse(response, parseCustomerDetailResponse);
}

export async function serverUpdateCustomer(id: string, input: UpdateCustomerInput): Promise<CustomerDetail> {
  const headers = await buildServerCookieHeaders();
  const response = await fetchAuthBackend(`/customers/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(input),
  });

  return parseCustomerApiResponse(response, parseCustomerDetailResponse);
}

export async function serverUpdateCustomerStatus(id: string, isActive: boolean): Promise<CustomerDetail> {
  const headers = await buildServerCookieHeaders();
  const response = await fetchAuthBackend(`/customers/${id}/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ is_active: isActive }),
  });

  return parseCustomerApiResponse(response, (payload) => customerDetailSchema.parse(payload));
}

export function extractCustomerErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof CustomerApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
