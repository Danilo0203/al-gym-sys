import { cookies } from "next/headers";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import {
  parseCustomerApiResponse,
  parseCustomerDetailResponse,
  parseCustomerListResponse,
  type CustomerDetail,
  type CustomerListResponse,
  type CustomerListSort,
} from "./local-customers";

async function getRequestHeaders(): Promise<HeadersInit | undefined> {
  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());

  return cookieHeader ? { cookie: cookieHeader } : undefined;
}

export async function serverGetCustomerById(id: string): Promise<CustomerDetail | null> {
  const response = await fetchAuthBackend(`/customers/${id}`, {
    method: "GET",
    headers: await getRequestHeaders(),
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  return parseCustomerApiResponse(response, parseCustomerDetailResponse);
}

export async function serverGetCustomersList(params: {
  page?: number;
  pageSize?: number;
  search?: string | null;
  sort?: CustomerListSort;
  isActive?: boolean;
} = {}): Promise<CustomerListResponse> {
  const searchParams = new URLSearchParams({
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 20),
  });

  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }

  if (params.sort) {
    searchParams.set("sort", params.sort);
  }

  if (params.isActive !== undefined) {
    searchParams.set("is_active", String(params.isActive));
  }

  const response = await fetchAuthBackend(`/customers?${searchParams.toString()}`, {
    method: "GET",
    headers: await getRequestHeaders(),
    cache: "no-store",
  });

  return parseCustomerApiResponse(response, parseCustomerListResponse);
}
