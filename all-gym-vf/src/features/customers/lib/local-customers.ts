import { z } from "zod";
import { parseJsonText } from "@/lib/auth/contracts";

export const customerGenderSchema = z.enum(["male", "female", "other"]);
export const customerListSortSchema = z.enum([
  "full_name",
  "-full_name",
  "created_at",
  "-created_at",
  "updated_at",
  "-updated_at",
  "last_check_in",
  "-last_check_in",
  "membership_status",
  "-membership_status",
]);

export const customerMembershipStatusSchema = z.enum([
  "active",
  "expiring",
  "grace",
  "expired",
  "cancelled",
  "none",
]);

export const customerMembershipSummarySchema = z.object({
  plan_id: z.number().int().nullable(),
  plan_name: z.string().nullable(),
  status: z.string().nullable(),
  display_status: customerMembershipStatusSchema,
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  grace_days: z.number().int().nullable(),
  access_until: z.string().nullable(),
});

export const customerListItemSchema = z.object({
  id: z.uuid(),
  email: z.string().email().nullable(),
  full_name: z.string(),
  phone: z.string(),
  avatar_url: z.string().nullable(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: customerGenderSchema,
  biometric_id: z.number().int(),
  is_active: z.boolean(),
  membership_status: customerMembershipStatusSchema,
  last_check_in: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  current_membership: customerMembershipSummarySchema.nullable(),
});

export const customerDetailSchema = customerListItemSchema.extend({
  role: z.literal("client"),
  injuries: z.string().nullable(),
  medical_notes: z.string().nullable(),
  account: z.object({
    email: z.string().email().nullable(),
    has_password: z.boolean(),
    login_enabled: z.boolean(),
  }).strict(),
  capabilities: z.object({
    update_customer: z.boolean(),
    manage_account: z.boolean(),
    manage_membership: z.boolean(),
    view_payments: z.boolean(),
  }).strict(),
}).strict();

export const customerListResponseSchema = z.object({
  data: z.array(customerListItemSchema),
  meta: z.object({
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    total_pages: z.number().int().nonnegative(),
  }),
});

export const customerSidebarResponseSchema = z.object({
  data: z.array(z.object({
    id: z.uuid(),
    full_name: z.string(),
    avatar_url: z.string().nullable(),
    biometric_id: z.number().int(),
    is_active: z.boolean(),
    membership_status: customerMembershipStatusSchema,
    plan_name: z.string().nullable(),
  })),
});

const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative(),
});

export const customerHistoryResponseSchema = z.object({
  customer_id: z.uuid(),
  memberships: z.object({
    data: z.array(z.object({
      id: z.uuid(),
      plan_id: z.number().int(),
      plan_name: z.string().nullable(),
      start_date: z.string(),
      end_date: z.string(),
      grace_days: z.number().int(),
      access_until: z.string(),
      status: z.string(),
      price: z.number(),
      discount_amount: z.number(),
      created_at: z.string(),
    })),
    meta: paginationMetaSchema,
  }),
  payments: z.object({
    data: z.array(z.object({
      id: z.uuid(),
      subscription_id: z.uuid().nullable(),
      payment_date: z.string(),
      amount_original: z.number(),
      discount_amount: z.number(),
      amount_paid: z.number(),
      method: z.string().nullable(),
      plan_name: z.string().nullable(),
    })),
    meta: paginationMetaSchema,
  }).nullable(),
  attendance: z.object({
    data: z.array(z.object({
      id: z.string(),
      check_in_time: z.string(),
      status: z.enum(["authorized", "denied"]),
    })),
    limit: z.number().int().positive().max(50),
    total: z.number().int().nonnegative(),
  }),
  heatmap: z.object({
    timezone: z.literal("America/Guatemala"),
    days: z.number().int().positive().max(365),
    from: z.string(),
    to: z.string(),
    data: z.array(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      count: z.number().int().nonnegative(),
    })),
  }),
  assessments: z.object({
    data: z.array(z.object({
      id: z.uuid(),
      assessment_date: z.string(),
      weight_kg: z.number().nullable(),
      height_cm: z.number().nullable(),
      body_fat_percentage: z.number().nullable(),
      muscle_mass_kg: z.number().nullable(),
      body_type: z.string().nullable(),
      activity_level: z.string().nullable(),
      water_liters_goal: z.number().nullable(),
      daily_calories: z.number().nullable(),
      protein_grams: z.number().nullable(),
      carbs_grams: z.number().nullable(),
      fat_grams: z.number().nullable(),
      chest: z.number().nullable(),
      waist: z.number().nullable(),
      hip: z.number().nullable(),
      arm_right: z.number().nullable(),
      arm_left: z.number().nullable(),
      leg_right: z.number().nullable(),
      leg_left: z.number().nullable(),
      diet_type: z.string().nullable(),
    })),
    meta: paginationMetaSchema,
  }),
  kpis: z.object({
    member_since: z.string().nullable(),
    total_visits: z.number().int().nonnegative(),
    total_spent: z.number().nullable(),
    initial_weight: z.number().nullable(),
    current_weight: z.number().nullable(),
    weight_change: z.number().nullable(),
  }),
});

export const createCustomerInputSchema = z.object({
  full_name: z.string().trim().min(2),
  phone: z.string().trim().min(1),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: customerGenderSchema,
  email: z.string().trim().email().optional().or(z.literal("")),
  password: z.string().min(8).max(128).optional(),
  injuries: z.string().trim().nullable().optional(),
  medical_notes: z.string().trim().nullable().optional(),
  membership: z.object({
    plan_id: z.number().int().positive(),
    cycles: z.number().int().min(1),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).strict().optional(),
}).strict().refine(
  (value) => value.password === undefined || Boolean(value.email?.trim()),
  {
    message: "PASSWORD_REQUIRES_EMAIL",
    path: ["password"],
  },
);

export const updateCustomerAccountInputSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(320).email().optional(),
    new_password: z.string().min(8).max(128).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "EMPTY_ACCOUNT_UPDATE",
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
export type CustomerSidebarResponse = z.infer<typeof customerSidebarResponseSchema>;
export type CustomerHistoryResponse = z.infer<typeof customerHistoryResponseSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;
export type UpdateCustomerAccountInput = z.infer<typeof updateCustomerAccountInputSchema>;
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

const allowedListSortColumns = new Set([
  "full_name",
  "created_at",
  "updated_at",
  "last_check_in",
  "membership_status",
]);

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
  isActive?: boolean;
  planId?: number;
  membershipStatus?: z.infer<typeof customerMembershipStatusSchema>;
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

  if (params.isActive !== undefined) {
    searchParams.set("is_active", String(params.isActive));
  }

  if (params.planId !== undefined) {
    searchParams.set("plan_id", String(params.planId));
  }

  if (params.membershipStatus) {
    searchParams.set("membership_status", params.membershipStatus);
  }

  return searchParams;
}

const customerErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
  }).passthrough(),
}).passthrough();

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
    const parsedError = customerErrorResponseSchema.safeParse(payload);
    const code = parsedError.success ? parsedError.data.error.code : null;

    switch (code) {
      case "EMAIL_ALREADY_EXISTS":
        return "El correo ya está utilizado por otra cuenta.";
      case "PASSWORD_REQUIRES_EMAIL":
        return "La contraseña requiere un correo configurado.";
      case "VALIDATION_ERROR":
        return "Revisa los datos ingresados.";
      case "UNAUTHORIZED":
      case "INVALID_SESSION":
        return "Tu sesión expiró. Vuelve a iniciar sesión.";
      case "FORBIDDEN":
        return "No tienes autorización para administrar esta cuenta.";
      case "CUSTOMER_NOT_FOUND":
        return "Cliente no encontrado.";
    }
  } catch {
    return status >= 500 ? "No fue posible completar la operación." : "No fue posible procesar la respuesta del servidor.";
  }

  if (status === 401) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (status === 403) return "No tienes autorización para administrar esta cuenta.";
  if (status === 404) return "Cliente no encontrado.";
  if (status === 409) return "El correo ya está utilizado por otra cuenta.";
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
