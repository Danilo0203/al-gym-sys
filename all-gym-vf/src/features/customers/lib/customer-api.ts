"use client";

import {
  createCustomerInputSchema,
  CustomerApiError,
  customerDetailSchema,
  customerHistoryResponseSchema,
  customerListResponseSchema,
  customerSidebarResponseSchema,
  parseCustomerApiResponse,
  updateCustomerInputSchema,
  updateCustomerAccountInputSchema,
  updateCustomerStatusInputSchema,
  type CreateCustomerInput,
  type CustomerDetail,
  type CustomerHistoryResponse,
  type CustomerListResponse,
  type CustomerSidebarResponse,
  type UpdateCustomerInput,
  type UpdateCustomerAccountInput,
} from "./local-customers";

async function fetchCustomersApi(pathname: string, init: RequestInit): Promise<Response> {
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

export async function getCustomersList(pathname: string): Promise<CustomerListResponse> {
  const response = await fetchCustomersApi(pathname, {
    method: "GET",
  });

  return parseCustomerApiResponse(response, (payload) => customerListResponseSchema.parse(payload));
}

export async function getCustomerSidebar(search: string, limit = 20): Promise<CustomerSidebarResponse> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (search.trim()) query.set("search", search.trim());
  const response = await fetchCustomersApi(`/api/customers/sidebar?${query.toString()}`, {
    method: "GET",
  });

  return parseCustomerApiResponse(response, (payload) => customerSidebarResponseSchema.parse(payload));
}

export async function getCustomerHistory(
  id: string,
  query: URLSearchParams,
): Promise<CustomerHistoryResponse> {
  const response = await fetchCustomersApi(`/api/customers/${id}/history?${query.toString()}`, {
    method: "GET",
  });

  return parseCustomerApiResponse(response, (payload) => customerHistoryResponseSchema.parse(payload));
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail> {
  const response = await fetchCustomersApi(`/api/customers/${id}`, {
    method: "GET",
  });

  return parseCustomerApiResponse(response, (payload) => customerDetailSchema.parse(payload));
}

export async function createCustomer(input: CreateCustomerInput): Promise<CustomerDetail> {
  const payload = createCustomerInputSchema.parse(input);
  const response = await fetchCustomersApi("/api/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return parseCustomerApiResponse(response, (parsed) => customerDetailSchema.parse(parsed));
}

export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<CustomerDetail> {
  const payload = updateCustomerInputSchema.parse(input);
  const response = await fetchCustomersApi(`/api/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return parseCustomerApiResponse(response, (parsed) => customerDetailSchema.parse(parsed));
}

export async function updateCustomerAccount(
  id: string,
  input: UpdateCustomerAccountInput,
): Promise<CustomerDetail> {
  const payload = updateCustomerAccountInputSchema.parse(input);
  const response = await fetchCustomersApi(`/api/customers/${id}/account`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return parseCustomerApiResponse(response, (parsed) => customerDetailSchema.parse(parsed));
}

export async function updateCustomerStatus(id: string, isActive: boolean): Promise<CustomerDetail> {
  const payload = updateCustomerStatusInputSchema.parse({
    is_active: isActive,
  });
  const response = await fetchCustomersApi(`/api/customers/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return parseCustomerApiResponse(response, (parsed) => customerDetailSchema.parse(parsed));
}
