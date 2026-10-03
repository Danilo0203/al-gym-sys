"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { localProductImageUrl } from "@/lib/media/local-product-image-url";
import type { TrainingProfileInput } from "@/lib/training/types";
import { customerDetailSchema, customerHistoryResponseSchema, customerListResponseSchema } from "@/features/customers/lib/local-customers";
import { customerRoutineWorkspaceSchema } from "@/features/customers/lib/local-customer-routine";


type SessionStatus = "open" | "closed" | "closed_with_difference" | "cancelled";
export type PaymentMethod = "cash" | "card" | "transfer";
type MovementType = "sale" | "manual_income" | "withdrawal" | "refund" | "adjustment" | "void";
export type MovementCategory = "membership" | "product" | "enrollment" | "service" | "other";
type SessionLinkStatus = "assigned" | "out_of_session";
type CashHistorySortItem = { id: string; desc: boolean };

interface CashDashboardSummary {
  openingAmount: number;
  expectedAmount: number;
  countedAmount: number | null;
  differenceAmount: number | null;
  totalsByMethod: Record<PaymentMethod, number>;
  refunds: number;
  adjustments: number;
  voids: number;
  salesCount: number;
}

export type CashSessionSummary = CashDashboardSummary;

export interface CashMovementView {
  id: string;
  cash_session_id: string | null;
  movement_type: MovementType;
  category: MovementCategory;
  payment_method: PaymentMethod | null;
  amount: number;
  cash_effect_amount: number;
  session_link_status: SessionLinkStatus;
  origin: "system" | "manual";
  source_payment_id: string | null;
  source_subscription_id: string | null;
  source_product_sale_id: string | null;
  source_product_sale_status: string | null;
  product_sale_number: string | null;
  product_sale_items_summary: string | null;
  customer_id: string | null;
  customer_name: string | null;
  created_by_user_id: string;
  created_by_name: string | null;
  note: string | null;
  created_at: string;
  voided_at: string | null;
  source_payment_status: string | null;
}

export interface CashProductSearchResult {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  sale_price: number;
  stock_quantity: number;
  is_active: boolean;
}

export interface CashProductSaleItemInput {
  productId: string;
  quantity: number;
}

export interface CashProductSaleResult {
  product_sale_id: string;
  sale_number: string;
  cash_movement_id: string;
  total_amount: number;
}

export interface CashProductSaleVoidResult {
  product_sale_id: string;
  cash_movement_id: string;
  inventory_movement_count: number;
}

export interface CashCustomerSearchResult {
  id: string;
  full_name: string;
  phone: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  subscription_end_date: string | null;
  subscription_grace_days?: number | null;
  subscription_access_until?: string | null;
  is_active: boolean;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  last_payment_method: PaymentMethod | null;
}

export interface CashCustomerSummary {
  id: string;
  full_name: string;
  phone: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  subscription_grace_days?: number | null;
  subscription_access_until?: string | null;
  is_active: boolean;
  birth_date: string | null;
  gender: "male" | "female" | "other" | null;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  last_payment_method: PaymentMethod | null;
  last_assessment: {
    weight_kg: number;
    height_cm: number;
    body_type: string;
    diet_type?: string;
    activity_level?: string;
    body_fat_percentage?: number | null;
    muscle_mass?: number | null;
    chest_cm?: number | null;
    waist_cm?: number | null;
    hip_cm?: number | null;
    arm_right_cm?: number | null;
    arm_left_cm?: number | null;
    leg_right_cm?: number | null;
    leg_left_cm?: number | null;
    injuries?: string;
  } | null;
  training_profile: TrainingProfileInput | null;
}

export interface CashSessionView {
  id: string;
  session_number: string;
  cash_register_id: string;
  cash_register_name: string;
  opened_by_user_id: string;
  opened_by_name: string | null;
  closed_by_user_id: string | null;
  closed_by_name: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  expected_amount: number | null;
  counted_amount: number | null;
  difference_amount: number | null;
  status: SessionStatus;
  notes: string | null;
}

export interface CashDashboardData {
  access: { role: string | null; userId: string };
  register: { id: string; name: string } | null;
  currentSession: CashSessionView | null;
  supervisedOpenSessions: CashSessionView[];
  summary: CashDashboardSummary | null;
  sessionMovements: CashMovementView[];
  outOfSessionMovements: CashMovementView[];
  activityMovements: CashMovementView[];
  canOpenSession: boolean;
  canOperateSession: boolean;
}

export interface EnsureCashRegisterResult {
  success: boolean;
  register?: { id: string; name: string };
  error?: string;
}

export interface CashHistoryFilters {
  page?: number;
  perPage?: number;
  sessionNumber?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: SessionStatus | "all" | null;
  openedByUserId?: string | null;
  sort?: CashHistorySortItem[] | null;
}

export interface CashHistoryData {
  access: { role: string | null; userId: string };
  sessions: CashSessionView[];
  availableUsers: Array<{ id: string; name: string }>;
  totalItems: number;
  filters: Required<Pick<CashHistoryFilters, "dateFrom" | "dateTo" | "status" | "openedByUserId">>;
}

export interface CashSessionDetailData {
  access: { role: string | null; userId: string };
  session: CashSessionView;
  summary: CashSessionSummary;
  movements: CashMovementView[];
}

export interface ReversePaymentInput {
  paymentId: string;
  amountOriginal: number;
  discountAmount: number;
  graceDays?: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  reason: string;
  sourceCategory?: MovementCategory;
  note?: string;
}

export interface CashPaymentReversalContext {
  payment_id: string;
  user_id: string;
  user_name: string;
  subscription_id: string | null;
  plan_name: string | null;
  amount_original: number;
  discount_amount: number;
  amount_paid: number;
  method: PaymentMethod;
  payment_date: string;
  status: string | null;
}

async function requireCashAccess() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !access.userId || !hasPermission(access, "cash.operate")) {
    throw new Error("No autorizado para operar caja");
  }

  return {
    role: access.role,
    userId: access.userId,
    isOwner: access.isOwner,
    permissions: access.permissions,
  };
}

async function localCashRequest(path: string, init?: RequestInit): Promise<Response> {
  const cookieStore = await cookies();
  const headers = new Headers(init?.headers);
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  if (cookieHeader) headers.set("cookie", cookieHeader);
  if (init?.body) headers.set("content-type", "application/json");
  return fetchAuthBackend(`/cash${path}`, { ...init, headers, cache: "no-store" });
}

async function localPaymentsRequest(path: string, init?: RequestInit): Promise<Response> {
  const cookieStore = await cookies();
  const headers = new Headers(init?.headers);
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  if (cookieHeader) headers.set("cookie", cookieHeader);
  if (init?.body) headers.set("content-type", "application/json");
  return fetchAuthBackend(`/payments${path}`, { ...init, headers, cache: "no-store" });
}

async function localCustomersRequest(path: string, init?: RequestInit): Promise<Response> {
  const cookieStore = await cookies();
  const headers = new Headers(init?.headers);
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return fetchAuthBackend(`/customers${path}`, { ...init, headers, cache: "no-store" });
}

async function localCashError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return new Error(payload?.error?.message || "No se pudo completar la operación de caja");
}

async function localPaymentsError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return new Error(payload?.error?.message || "No se pudo completar la operación del pago");
}

async function localCustomersError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return new Error(payload?.error?.message || "No se pudo cargar el cliente local");
}

async function requireOperableOpenCashSession(accessArg?: Awaited<ReturnType<typeof requireCashAccess>>) {
  if (!accessArg) await requireCashAccess();
  const response = await localCashRequest("/dashboard");
  if (!response.ok) throw await localCashError(response);
  const dashboard = await response.json() as CashDashboardData;
  const session = dashboard.currentSession;
  if (!session) {
    throw new Error("Abre una caja antes de registrar cobros desde este modulo.");
  }

  return session;
}

export async function getCashDashboardData(): Promise<CashDashboardData> {
  await requireCashAccess();
  const response = await localCashRequest("/dashboard");
  if (!response.ok) throw await localCashError(response);
  return await response.json() as CashDashboardData;
}

export async function ensureDefaultCashRegister(): Promise<EnsureCashRegisterResult> {
  try {
    const access = await requireCashAccess();
    if (!(access.isOwner || access.role === "admin")) {
      return { success: false, error: "No autorizado para configurar la caja principal" };
    }
    const response = await localCashRequest("/registers/default", { method: "POST" });
    if (!response.ok) throw await localCashError(response);
    const payload = await response.json() as { register: { id: string; name: string } };
    revalidatePath("/panel/caja");
    return { success: true, register: payload.register };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo configurar la caja principal" };
  }
}

export async function searchCashCustomers(search: string): Promise<CashCustomerSearchResult[]> {
  await requireOperableOpenCashSession();
  const query = new URLSearchParams({ page: "1", page_size: "12", sort: "full_name" });
  const normalizedSearch = search.trim();
  if (normalizedSearch) query.set("search", normalizedSearch);

  const response = await localCustomersRequest(`?${query.toString()}`);
  if (!response.ok) throw await localCustomersError(response);
  const customers = customerListResponseSchema.parse(await response.json()).data;

  return customers.map((customer) => ({
    id: customer.id,
    full_name: customer.full_name,
    phone: customer.phone,
    plan_name: customer.current_membership?.plan_name ?? null,
    subscription_status: customer.membership_status,
    subscription_end_date: customer.current_membership?.end_date ?? null,
    subscription_grace_days: customer.current_membership?.grace_days ?? null,
    subscription_access_until: customer.current_membership?.access_until ?? null,
    is_active: customer.is_active,
    last_payment_date: null,
    last_payment_amount: null,
    last_payment_method: null,
  }));
}

export async function getCashCustomerSummary(customerId: string): Promise<CashCustomerSummary | null> {
  const access = await requireCashAccess();
  await requireOperableOpenCashSession(access);

  const customerResponse = await localCustomersRequest(`/${encodeURIComponent(customerId)}`);
  if (customerResponse.status === 404) return null;
  if (!customerResponse.ok) throw await localCustomersError(customerResponse);
  const customer = customerDetailSchema.parse(await customerResponse.json());

  const historyQuery = new URLSearchParams({
    attendance_limit: "1",
    heatmap_days: "1",
    memberships_page_size: "1",
    payments_page_size: "1",
    assessments_page_size: "1",
  });
  const historyResponse = await localCustomersRequest(
    `/${encodeURIComponent(customerId)}/history?${historyQuery.toString()}`,
  );
  if (!historyResponse.ok) throw await localCustomersError(historyResponse);
  const history = customerHistoryResponseSchema.parse(await historyResponse.json());

  let trainingProfile: TrainingProfileInput | null = null;
  if (access.isOwner || access.permissions?.includes("customers.manage_routine")) {
    const routineResponse = await localCustomersRequest(`/${encodeURIComponent(customerId)}/routine`);
    if (!routineResponse.ok) throw await localCustomersError(routineResponse);
    const workspace = customerRoutineWorkspaceSchema.parse(await routineResponse.json());
    const training = workspace.trainingProfile;
    trainingProfile = training
      ? {
          primary_goal: training.primary_goal,
          secondary_goal: training.secondary_goal,
          focus_areas: training.focus_areas,
          experience_level: training.experience_level,
          days_per_week: training.days_per_week,
          session_minutes: training.session_minutes,
          training_location: training.training_location,
          equipment_available: training.equipment_available,
          activity_level: training.activity_level,
          cardio_preference: training.cardio_preference,
          exercise_preferences: training.exercise_preferences,
          exercise_dislikes: training.exercise_dislikes,
          injuries_or_pain: training.injuries_or_pain,
          restricted_movements: training.restricted_movements,
          parq_requires_attention: training.parq_requires_attention,
          medical_clearance_notes: training.medical_clearance_notes,
        }
      : null;
  }

  const membership = customer.current_membership;
  const payment = history.payments?.data[0];
  const assessment = history.assessments?.data[0];
  const paymentMethod = payment?.method;
  const lastPaymentMethod = paymentMethod === "cash" || paymentMethod === "card" || paymentMethod === "transfer"
    ? paymentMethod
    : null;

  return {
    id: customer.id,
    full_name: customer.full_name,
    phone: customer.phone,
    plan_name: membership?.plan_name ?? null,
    subscription_status: customer.membership_status,
    subscription_start_date: membership?.start_date ?? null,
    subscription_end_date: membership?.end_date ?? null,
    subscription_grace_days: membership?.grace_days ?? null,
    subscription_access_until: membership?.access_until ?? null,
    is_active: customer.is_active,
    birth_date: customer.birth_date,
    gender: customer.gender,
    last_payment_date: payment?.payment_date ?? null,
    last_payment_amount: payment?.amount_paid ?? null,
    last_payment_method: lastPaymentMethod,
    last_assessment: assessment
      ? {
          weight_kg: assessment.weight_kg ?? 0,
          height_cm: assessment.height_cm ?? 0,
          body_type: assessment.body_type || "mesomorph",
          diet_type: assessment.diet_type || undefined,
          activity_level: trainingProfile?.activity_level || assessment.activity_level || undefined,
          body_fat_percentage: assessment.body_fat_percentage,
          muscle_mass: assessment.muscle_mass_kg,
          chest_cm: assessment.chest,
          waist_cm: assessment.waist,
          hip_cm: assessment.hip,
          arm_right_cm: assessment.arm_right,
          arm_left_cm: assessment.arm_left,
          leg_right_cm: assessment.leg_right,
          leg_left_cm: assessment.leg_left,
          injuries: customer.injuries || undefined,
        }
      : null,
    training_profile: trainingProfile,
  };
}

export async function getCashHistoryData(filters: CashHistoryFilters = {}): Promise<CashHistoryData> {
  await requireCashAccess();
  const query = new URLSearchParams({
    page: String(filters.page && filters.page > 0 ? filters.page : 1),
    perPage: String(filters.perPage && filters.perPage > 0 ? filters.perPage : 10),
  });
  if (filters.sessionNumber) query.set("sessionNumber", filters.sessionNumber);
  if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) query.set("dateTo", filters.dateTo);
  if (filters.status) query.set("status", filters.status);
  if (filters.openedByUserId) query.set("openedByUserId", filters.openedByUserId);
  const allowedSort = new Set(["session_number", "opened_at", "closed_at", "opening_amount", "difference_amount", "status"]);
  const sort = filters.sort?.filter((item) => allowedSort.has(item.id));
  if (sort?.length) query.set("sort", sort.map((item) => `${item.id}:${item.desc ? "desc" : "asc"}`).join(","));
  const response = await localCashRequest(`/sessions?${query.toString()}`);
  if (!response.ok) throw await localCashError(response);
  return await response.json() as CashHistoryData;
}

export async function getCashSessionDetail(sessionId: string): Promise<CashSessionDetailData> {
  await requireCashAccess();
  const response = await localCashRequest(`/sessions/${encodeURIComponent(sessionId)}`);
  if (!response.ok) throw await localCashError(response);
  return await response.json() as CashSessionDetailData;
}

export async function openCashSession(registerId: string, openingAmount: number, notes?: string) {
  await requireCashAccess();
  const response = await localCashRequest("/sessions", {
    method: "POST",
    body: JSON.stringify({ registerId, openingAmount, notes }),
  });
  if (!response.ok) throw await localCashError(response);
  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
}

export async function closeCashSession(
  sessionId: string,
  countedAmount: number,
  notes?: string,
  adminPassword?: string,
) {
  await requireCashAccess();
  const response = await localCashRequest(`/sessions/${encodeURIComponent(sessionId)}/close`, {
    method: "POST",
    body: JSON.stringify({ countedAmount, notes, adminPassword }),
  });
  if (!response.ok) throw await localCashError(response);
  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
  revalidatePath(`/panel/caja/historial/${sessionId}`);
  revalidatePath("/panel/pagos");
  revalidatePath("/panel/resumen");
}

export async function recordManualCashMovement(
  sessionId: string,
  movementType: "manual_income" | "withdrawal",
  amount: number,
  note: string,
) {
  await requireCashAccess();
  const response = await localCashRequest(`/sessions/${encodeURIComponent(sessionId)}/movements`, {
    method: "POST",
    body: JSON.stringify({ movementType, amount, note }),
  });
  if (!response.ok) throw await localCashError(response);
  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
  revalidatePath(`/panel/caja/historial/${sessionId}`);
}

export async function getPaymentReversalContext(paymentId: string): Promise<CashPaymentReversalContext | null> {
  await requireCashAccess();
  const response = await localPaymentsRequest(`/${encodeURIComponent(paymentId)}/reversal-context`);
  if (!response.ok) throw await localPaymentsError(response);
  return await response.json() as CashPaymentReversalContext | null;
}

export async function reverseAndRecreatePayment(input: ReversePaymentInput) {
  await requireCashAccess();
  const response = await localPaymentsRequest(`/${encodeURIComponent(input.paymentId)}/reverse`, {
    method: "POST",
    body: JSON.stringify({
      amountOriginal: input.amountOriginal,
      discountAmount: input.discountAmount,
      amountPaid: input.amountPaid,
      paymentMethod: input.paymentMethod,
      reason: input.reason.trim(),
      sourceCategory: input.sourceCategory ?? "membership",
      note: input.note?.trim() || undefined,
    }),
  });
  if (!response.ok) throw await localPaymentsError(response);

  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
  revalidatePath("/panel/pagos");
  revalidatePath("/panel/resumen");

  return await response.json() as {
    reversed_payment_id: string;
    replacement_payment_id: string;
    reversal_movement_id: string;
    replacement_movement_id: string;
  };
}

export async function searchCashProducts(search: string): Promise<CashProductSearchResult[]> {
  await requireOperableOpenCashSession();
  const access = await requireCashAccess();
  if (!access.isOwner && !access.permissions.includes("inventory.sell")) {
    throw new Error("No autorizado para vender productos");
  }
  const query = new URLSearchParams({ search: search.trim() });
  const response = await localCashRequest(`/products/search?${query.toString()}`);
  if (!response.ok) throw await localCashError(response);
  const products = await response.json() as CashProductSearchResult[];
  return products.map((product) => ({
    ...product,
    image_url: localProductImageUrl(product.image_url),
  }));
}

export async function sellProductsFromCashSession(params: {
  items: CashProductSaleItemInput[];
  paymentMethod: PaymentMethod;
  note?: string | null;
}): Promise<CashProductSaleResult> {
  const access = await requireCashAccess();
  if (!access.isOwner && !access.permissions.includes("inventory.sell")) {
    throw new Error("No autorizado para vender productos");
  }

  await requireOperableOpenCashSession(access);

  const response = await localCashRequest("/products/sales", {
    method: "POST",
    body: JSON.stringify({
      items: params.items,
      paymentMethod: params.paymentMethod,
      note: params.note?.trim() || null,
    }),
  });
  if (!response.ok) throw await localCashError(response);

  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
  revalidatePath("/panel/inventario/productos");
  revalidatePath("/panel/inventario/movimientos");
  revalidatePath("/panel/resumen");

  return await response.json() as CashProductSaleResult;
}

export async function voidProductSaleFromCashSession(params: {
  productSaleId: string;
  note?: string | null;
}): Promise<CashProductSaleVoidResult> {
  const access = await requireCashAccess();
  await requireOperableOpenCashSession(access);

  const response = await localCashRequest(
    `/products/sales/${encodeURIComponent(params.productSaleId)}/void`, {
      method: "POST",
      body: JSON.stringify({ note: params.note?.trim() || null }),
    },
  );
  if (!response.ok) throw await localCashError(response);

  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
  revalidatePath("/panel/inventario/productos");
  revalidatePath("/panel/inventario/movimientos");
  revalidatePath("/panel/resumen");

  return await response.json() as CashProductSaleVoidResult;
}


export async function searchPendingCashCustomers(search: string): Promise<CashCustomerSearchResult[]> {
  await requireOperableOpenCashSession();
  const normalizedSearch = search.trim();
  
  const fetchStatus = async (status: string) => {
    const query = new URLSearchParams({ page: "1", page_size: "20", sort: "-created_at", membership_status: status });
    if (normalizedSearch) query.set("search", normalizedSearch);
    
    const response = await localCustomersRequest(`?${query.toString()}`);
    if (!response.ok) throw await localCustomersError(response);
    return customerListResponseSchema.parse(await response.json()).data;
  };

  const [pending, none] = await Promise.all([
    fetchStatus("pending"),
    fetchStatus("none"),
  ]);

  const combined = [...pending, ...none].sort((a, b) => {
    // Sort by created_at descending
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  return combined.map((customer) => ({
    id: customer.id,
    full_name: customer.full_name,
    phone: customer.phone,
    plan_name: customer.current_membership?.plan_name ?? null,
    subscription_status: customer.membership_status,
    subscription_end_date: customer.current_membership?.end_date ?? null,
    subscription_grace_days: customer.current_membership?.grace_days ?? null,
    subscription_access_until: customer.current_membership?.access_until ?? null,
    is_active: customer.is_active,
    last_payment_date: null,
    last_payment_amount: null,
    last_payment_method: null,
  }));
}
