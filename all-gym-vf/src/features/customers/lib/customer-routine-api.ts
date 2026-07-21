"use client";

import { CustomerApiError, parseCustomerApiResponse } from "./local-customers";
import {
  createCustomerRoutineInputSchema,
  createRoutineDetailInputSchema,
  customerRoutineMutationResponseSchema,
  routineDetailMutationResponseSchema,
  updateCustomerRoutineInputSchema,
  updateRoutineDetailInputSchema,
  type CreateCustomerRoutineInput,
  type CreateRoutineDetailInput,
  type CustomerRoutineMutationResponse,
  type RoutineDetailMutationResponse,
  type UpdateCustomerRoutineInput,
  type UpdateRoutineDetailInput,
} from "./local-customer-routine";

async function fetchRoutineApi(pathname: string, init: RequestInit): Promise<Response> {
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

export async function createCustomerRoutine(
  customerId: string,
  input: CreateCustomerRoutineInput,
): Promise<CustomerRoutineMutationResponse> {
  const payload = createCustomerRoutineInputSchema.parse(input);
  const response = await fetchRoutineApi(`/api/customers/${customerId}/routines`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseCustomerApiResponse(response, (value) => customerRoutineMutationResponseSchema.parse(value));
}

export async function updateCustomerRoutine(
  customerId: string,
  routineId: string,
  input: UpdateCustomerRoutineInput,
): Promise<CustomerRoutineMutationResponse> {
  const payload = updateCustomerRoutineInputSchema.parse(input);
  const response = await fetchRoutineApi(`/api/customers/${customerId}/routines/${routineId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return parseCustomerApiResponse(response, (value) => customerRoutineMutationResponseSchema.parse(value));
}

export async function createRoutineDetail(
  customerId: string,
  routineId: string,
  input: CreateRoutineDetailInput,
): Promise<RoutineDetailMutationResponse> {
  const payload = createRoutineDetailInputSchema.parse(input);
  const response = await fetchRoutineApi(`/api/customers/${customerId}/routines/${routineId}/details`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseCustomerApiResponse(response, (value) => routineDetailMutationResponseSchema.parse(value));
}

export async function updateRoutineDetail(
  customerId: string,
  routineId: string,
  detailId: number,
  input: UpdateRoutineDetailInput,
): Promise<RoutineDetailMutationResponse> {
  const payload = updateRoutineDetailInputSchema.parse(input);
  const response = await fetchRoutineApi(
    `/api/customers/${customerId}/routines/${routineId}/details/${detailId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return parseCustomerApiResponse(response, (value) => routineDetailMutationResponseSchema.parse(value));
}

export async function deleteRoutineDetail(
  customerId: string,
  routineId: string,
  detailId: number,
): Promise<void> {
  const response = await fetchRoutineApi(
    `/api/customers/${customerId}/routines/${routineId}/details/${detailId}`,
    { method: "DELETE" },
  );
  if (response.status === 204) return;
  await parseCustomerApiResponse(response, () => undefined);
}
