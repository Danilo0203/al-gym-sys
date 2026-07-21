import { z } from "zod";
import { getAuthErrorMessage, parseJsonText } from "@/lib/auth/contracts";

export const customerGenderSchema = z.enum(["male", "female", "other"]);
export const customerListSortSchema = z.enum([
  "full_name",
  "-full_name",
  "created_at",
  "-created_at",
  "updated_at",
  "-updated_at",
]);

export const customerListItemSchema = z.object({
  id: z.uuid(),
  email: z.string().email().nullable(),
  full_name: z.string(),
  phone: z.string(),
  avatar_url: z.string().nullable(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: customerGenderSchema,
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  current_membership: z.unknown().nullable(),
});

export const customerDetailSchema = customerListItemSchema.extend({
  role: z.literal("client"),
  injuries: z.string().nullable(),
  medical_notes: z.string().nullable(),
});

export const customerListResponseSchema = z.object({
  data: z.array(customerListItemSchema),
  meta: z.object({
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    total_pages: z.number().int().nonnegative(),
  }),
});

export const createCustomerInputSchema = z.object({
  full_name: z.string().trim().min(2),
  phone: z.string().trim().min(1),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: customerGenderSchema,
  email: z.string().trim().email().optional().or(z.literal("")),
  injuries: z.string().trim().nullable().optional(),
  medical_notes: z.string().trim().nullable().optional(),
});

export const updateCustomerInputSchema = z
  .object({
    full_name: z.string().trim().min(2).optional(),
    phone: z.string().trim().min(1).optional(),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    gender: customerGenderSchema.optional(),
    injuries: z.string().trim().nullable().optional(),
    medical_notes: z.string().trim().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "EMPTY_CUSTOMER_UPDATE",
  });

export const updateCustomerStatusInputSchema = z.object({
  is_active: z.boolean(),
});

export type CustomerListItem = z.infer<typeof customerListItemSchema>;
export type CustomerDetail = z.infer<typeof customerDetailSchema>;
export type CustomerListResponse = z.infer<typeof customerListResponseSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>;
export type UpdateCustomerStatusInput = z.infer<typeof updateCustomerStatusInputSchema>;
export type CustomerListSort = z.infer<typeof customerListSortSchema>;

export class CustomerApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CustomerApiError";
    this.status = status;
  }
}

const allowedListSortColumns = new Set(["full_name", "created_at", "updated_at"]);

export function isValidCalendarDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function normalizeOptionalCustomerText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeOptionalCustomerEmail(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

export function sortingStateToBackendSort(
  sorting: Array<{ id: string; desc: boolean }> | null | undefined,
): CustomerListSort | undefined {
  const [firstSort] = sorting || [];

  if (!firstSort || !allowedListSortColumns.has(firstSort.id)) {
    return undefined;
  }

  const normalized = firstSort.desc ? `-${firstSort.id}` : firstSort.id;
  const result = customerListSortSchema.safeParse(normalized);

  return result.success ? result.data : undefined;
}

export function mapCustomerListQuery(params: {
  page?: number;
  pageSize?: number;
  search?: string | null;
  sort?: CustomerListSort;
}) {
  const searchParams = new URLSearchParams();

  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("page_size", String(params.pageSize ?? 10));

  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }

  if (params.sort) {
    searchParams.set("sort", params.sort);
  }

  return searchParams;
}

function getCustomerErrorMessage(status: number, responseText: string): string {
  if (!responseText.trim()) {
    if (status === 401) return "Tu sesión expiró. Vuelve a iniciar sesión.";
    if (status === 403) return "No tienes permisos para gestionar clientes.";
    if (status === 404) return "Cliente no encontrado.";
    if (status >= 500) return "No fue posible completar la operación.";
    return "No fue posible completar la operación.";
  }

  try {
    const payload = parseJsonText(responseText, "Customers API");
    const backendMessage = getAuthErrorMessage(payload);
    if (backendMessage) {
      return backendMessage;
    }

    if (payload && typeof payload === "object") {
      const maybeError = "error" in payload ? payload.error : null;
      if (typeof maybeError === "string" && maybeError.trim()) {
        return maybeError;
      }
      if (maybeError && typeof maybeError === "object" && "message" in maybeError && typeof maybeError.message === "string") {
        return maybeError.message;
      }
      if ("message" in payload && typeof payload.message === "string" && payload.message.trim()) {
        return payload.message;
      }
    }
  } catch {
    return status >= 500 ? "No fue posible completar la operación." : "No fue posible procesar la respuesta del servidor.";
  }

  if (status === 401) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (status === 403) return "No tienes permisos para gestionar clientes.";
  if (status === 404) return "Cliente no encontrado.";
  if (status === 409) return "Ya existe un cliente o usuario con ese correo.";
  if (status >= 500) return "No fue posible completar la operación.";

  return "No fue posible completar la operación.";
}

export async function parseCustomerApiResponse<T>(
  response: Response,
  parser: (payload: unknown) => T,
): Promise<T> {
  const responseText = await response.text();

  if (!response.ok) {
    throw new CustomerApiError(getCustomerErrorMessage(response.status, responseText), response.status);
  }

  return parser(parseJsonText(responseText, "Customers API"));
}

export function parseCustomerListResponse(payload: unknown): CustomerListResponse {
  const result = customerListResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new Error("Customers API devolvió un contrato inválido para el listado.");
  }

  return result.data;
}

export function parseCustomerDetailResponse(payload: unknown): CustomerDetail {
  const result = customerDetailSchema.safeParse(payload);

  if (!result.success) {
    throw new Error("Customers API devolvió un contrato inválido para el detalle.");
  }

  return result.data;
}
