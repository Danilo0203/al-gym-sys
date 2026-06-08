"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { toCashActionError } from "@/features/cash/lib/cash-module-errors";
import type { TrainingProfileInput } from "@/lib/training/types";
import { normalizeGraceDays } from "@/lib/subscriptions/grace-period";

const GUATEMALA_UTC_OFFSET = "-06:00";
const CASH_CLOSE_WITHOUT_PASSWORD_PERMISSION = "cash.close_without_admin_password";

type SessionStatus = "open" | "closed" | "closed_with_difference" | "cancelled";
export type PaymentMethod = "cash" | "card" | "transfer";
type MovementType = "sale" | "manual_income" | "withdrawal" | "refund" | "adjustment" | "void";
export type MovementCategory = "membership" | "product" | "enrollment" | "service" | "other";
type SessionLinkStatus = "assigned" | "out_of_session";
type CashHistorySortItem = { id: string; desc: boolean };

interface CashRegisterRow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface CashSessionRow {
  id: string;
  session_number: string;
  cash_register_id: string;
  opened_by_user_id: string;
  closed_by_user_id: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number | string;
  expected_amount: number | string | null;
  counted_amount: number | string | null;
  difference_amount: number | string | null;
  status: SessionStatus;
  notes: string | null;
  created_at: string;
}

interface CashHistoryUserRow {
  opened_by_user_id: string;
}

interface CashMovementRow {
  id: string;
  cash_session_id: string | null;
  movement_type: MovementType;
  category: MovementCategory;
  payment_method: PaymentMethod | null;
  amount: number | string;
  cash_effect_amount: number | string;
  session_link_status: SessionLinkStatus;
  origin: "system" | "manual";
  source_payment_id: string | null;
  source_subscription_id: string | null;
  source_product_sale_id: string | null;
  customer_id: string | null;
  created_by_user_id: string;
  note: string | null;
  created_at: string;
  voided_at: string | null;
  voided_by_user_id: string | null;
}

interface ProductSaleRow {
  id: string;
  sale_number: string;
  total_amount: number | string;
  status: string | null;
}

interface ProductSaleItemRow {
  product_sale_id: string;
  product_name: string;
  quantity: number | string;
  line_total: number | string;
}

interface ProductInventoryRow {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  sale_price: number | string;
  stock_quantity: number | string;
  is_active: boolean;
}

interface ProfileNameRow {
  id: string;
  full_name: string | null;
}

interface CashCustomerRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  subscription_end_date: string | null;
  subscription_grace_days?: number | null;
  subscription_access_until?: string | null;
  is_active: boolean | null;
}

interface CustomerProfileRow {
  id: string;
  birth_date: string | null;
  gender: "male" | "female" | "other" | null;
  injuries: string | null;
  medical_notes: string | null;
}

interface BodyAssessmentRow {
  user_id: string;
  date: string;
  weight_kg: number | string | null;
  height_cm: number | string | null;
  body_type: string | null;
  diet_type: string | null;
  activity_level: string | null;
  body_fat_percentage: number | string | null;
  muscle_mass_kg: number | string | null;
  chest: number | string | null;
  waist: number | string | null;
  hip: number | string | null;
  arm_right: number | string | null;
  arm_left: number | string | null;
  leg_right: number | string | null;
  leg_left: number | string | null;
}

interface TrainingProfileRow extends TrainingProfileInput {
  user_id: string;
  is_complete: boolean | null;
}

interface PaymentSummaryRow {
  user_id: string;
  payment_date: string;
  amount_paid: number | string | null;
  method: PaymentMethod | null;
  status?: string | null;
}

interface PaymentStatusRow {
  id: string;
  status: string | null;
}

interface PlanFinancialRow {
  id: number;
  price: number | string;
  duration_days: number | string | null;
}

interface PaymentRpcResult {
  subscription_id: string | null;
  payment_id: string | null;
  cash_movement_id: string | null;
  session_link_status: SessionLinkStatus | null;
}

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

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = typeof value === "number" ? value : Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message || "");
  }

  return "";
}

function isPaymentMethodEnumTypeMismatch(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('column "method" is of type payment_method') && message.includes("expression is of type text");
}

function isPaymentMethod(value: string | null | undefined): value is PaymentMethod {
  return value === "cash" || value === "card" || value === "transfer";
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

type CashCloseAccess = {
  role: string | null;
  userId: string;
  isOwner: boolean;
  permissions: string[];
};

function createPasswordAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase auth credentials.");
  }

  return createSupabaseJsClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function listAuthUsersByIds(adminClient: ReturnType<typeof createAdminClient>, userIds: string[]) {
  if (userIds.length === 0) return [] as Array<{ id: string; email: string | null }>;

  const normalizedIds = new Set(userIds);
  const users: Array<{ id: string; email: string | null }> = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    for (const user of data.users || []) {
      if (normalizedIds.has(user.id)) {
        users.push({ id: user.id, email: user.email || null });
      }
    }

    if ((data.users || []).length < perPage) break;
    page += 1;
  }

  return users;
}

async function resolveCashCloseAuthorizer(params: {
  access: CashCloseAccess;
  adminPassword?: string;
}) {
  const { access, adminPassword } = params;
  const canCloseWithoutPassword = Boolean(
    access.isOwner || access.role === "admin" || access.permissions.includes(CASH_CLOSE_WITHOUT_PASSWORD_PERMISSION),
  );

  if (canCloseWithoutPassword) {
    return {
      requestedByUserId: access.userId,
      closedByUserId: access.userId,
    };
  }

  const password = adminPassword?.trim();
  if (!password) {
    throw new Error("Debes ingresar la contraseña de un administrador u owner para cerrar la caja.");
  }

  const adminClient = createAdminClient();
  const { data: privilegedProfiles, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role")
    .in("role", ["owner", "admin"]);

  if (profileError) {
    throw profileError;
  }

  const privilegedIds = (privilegedProfiles || []).map((row) => String(row.id));
  const privilegedUsers = await listAuthUsersByIds(adminClient, privilegedIds);
  const authClient = createPasswordAuthClient();

  for (const user of privilegedUsers) {
    if (!user.email) continue;

    const { data, error } = await authClient.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (!error && data.session) {
      return {
        requestedByUserId: access.userId,
        closedByUserId: user.id,
      };
    }
  }

  throw new Error("La contraseña no coincide con ningún administrador u owner.");
}

async function requireOperableOpenCashSession(accessArg?: Awaited<ReturnType<typeof requireCashAccess>>) {
  const access = accessArg ?? (await requireCashAccess());
  const adminClient = createAdminClient();
  const { data: sessionRows, error } = await adminClient
    .from("cash_sessions")
    .select("*")
    .eq("opened_by_user_id", access.userId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1);

  if (error) {
    throw toCashActionError(error, "Error al validar sesion operativa de caja");
  }

  const session = (sessionRows as CashSessionRow[] | null)?.[0] || null;
  if (!session) {
    throw new Error("Abre una caja antes de registrar cobros desde este modulo.");
  }

  return session;
}

function getGuatemalaDateRange(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const [year, month, day] = formatter.format(date).split("-");
  return {
    start: `${year}-${month}-${day}T00:00:00${GUATEMALA_UTC_OFFSET}`,
    end: `${year}-${month}-${day}T23:59:59.999${GUATEMALA_UTC_OFFSET}`,
  };
}

function buildNameMap(rows: ProfileNameRow[] | null | undefined) {
  return new Map((rows || []).map((row) => [row.id, row.full_name || "Usuario"]));
}

function buildLatestPaymentMap(rows: PaymentSummaryRow[] | null | undefined) {
  const latestPaymentMap = new Map<
    string,
    {
      payment_date: string;
      amount_paid: number | null;
      method: PaymentMethod | null;
    }
  >();

  for (const row of rows || []) {
    if (row.status && row.status !== "posted") {
      continue;
    }

    if (!latestPaymentMap.has(row.user_id)) {
      latestPaymentMap.set(row.user_id, {
        payment_date: row.payment_date,
        amount_paid: toNumber(row.amount_paid),
        method: row.method,
      });
    }
  }

  return latestPaymentMap;
}

function formatProductQuantity(value: number | string | null | undefined) {
  const quantity = toNumber(value) || 0;
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function buildProductSaleSummaryMap(
  sales: ProductSaleRow[] | null | undefined,
  items: ProductSaleItemRow[] | null | undefined,
) {
  const itemMap = new Map<string, string[]>();

  for (const item of items || []) {
    const existing = itemMap.get(item.product_sale_id) || [];
    existing.push(`${item.product_name} x${formatProductQuantity(item.quantity)}`);
    itemMap.set(item.product_sale_id, existing);
  }

  return new Map(
    (sales || []).map((sale) => [
      sale.id,
      {
        saleNumber: sale.sale_number,
        status: sale.status || null,
        itemsSummary: itemMap.get(sale.id)?.join(", ") || null,
      },
    ]),
  );
}

function mapSessionRow(
  row: CashSessionRow,
  registerMap: Map<string, string>,
  profileMap: Map<string, string>,
): CashSessionView {
  return {
    id: row.id,
    session_number: row.session_number,
    cash_register_id: row.cash_register_id,
    cash_register_name: registerMap.get(row.cash_register_id) || "Caja",
    opened_by_user_id: row.opened_by_user_id,
    opened_by_name: profileMap.get(row.opened_by_user_id) || "Usuario",
    closed_by_user_id: row.closed_by_user_id,
    closed_by_name: row.closed_by_user_id ? profileMap.get(row.closed_by_user_id) || "Usuario" : null,
    opened_at: row.opened_at,
    closed_at: row.closed_at,
    opening_amount: toNumber(row.opening_amount) || 0,
    expected_amount: toNumber(row.expected_amount),
    counted_amount: toNumber(row.counted_amount),
    difference_amount: toNumber(row.difference_amount),
    status: row.status,
    notes: row.notes,
  };
}

function mapMovementRows(
  rows: CashMovementRow[],
  profileMap: Map<string, string>,
  paymentStatusMap: Map<string, string | null> = new Map(),
  productSaleSummaryMap: Map<string, { saleNumber: string; status: string | null; itemsSummary: string | null }> = new Map(),
): CashMovementView[] {
  return rows.map((row) => ({
    id: row.id,
    cash_session_id: row.cash_session_id,
    movement_type: row.movement_type,
    category: row.category,
    payment_method: row.payment_method,
    amount: toNumber(row.amount) || 0,
    cash_effect_amount: toNumber(row.cash_effect_amount) || 0,
    session_link_status: row.session_link_status,
    origin: row.origin,
    source_payment_id: row.source_payment_id,
    source_subscription_id: row.source_subscription_id,
    source_product_sale_id: row.source_product_sale_id,
    source_product_sale_status: row.source_product_sale_id
      ? productSaleSummaryMap.get(row.source_product_sale_id)?.status || null
      : null,
    product_sale_number: row.source_product_sale_id
      ? productSaleSummaryMap.get(row.source_product_sale_id)?.saleNumber || null
      : null,
    product_sale_items_summary: row.source_product_sale_id
      ? productSaleSummaryMap.get(row.source_product_sale_id)?.itemsSummary || null
      : null,
    customer_id: row.customer_id,
    customer_name: row.customer_id ? profileMap.get(row.customer_id) || "Cliente" : null,
    created_by_user_id: row.created_by_user_id,
    created_by_name: profileMap.get(row.created_by_user_id) || "Usuario",
    note: row.note,
    created_at: row.created_at,
    voided_at: row.voided_at,
    source_payment_status: row.source_payment_id ? paymentStatusMap.get(row.source_payment_id) || null : null,
  }));
}

function buildCashSummary(movements: CashMovementView[], openingAmount: number): CashDashboardSummary {
  const summary: CashDashboardSummary = {
    openingAmount,
    expectedAmount: openingAmount,
    countedAmount: null,
    differenceAmount: null,
    totalsByMethod: {
      cash: 0,
      card: 0,
      transfer: 0,
    },
    refunds: 0,
    adjustments: 0,
    voids: 0,
    salesCount: 0,
  };

  for (const movement of movements) {
    if (movement.voided_at) continue;

    summary.expectedAmount += movement.cash_effect_amount;

    if (movement.movement_type === "sale") {
      summary.salesCount += 1;
      if (movement.payment_method) {
        summary.totalsByMethod[movement.payment_method] += movement.amount;
      }
      continue;
    }

    if (movement.movement_type === "refund") {
      summary.refunds += movement.amount;
      continue;
    }

    if (movement.movement_type === "adjustment") {
      summary.adjustments += movement.cash_effect_amount;
      continue;
    }

    if (movement.movement_type === "void") {
      summary.voids += movement.amount;
    }
  }

  return summary;
}

async function hydrateSessions(sessions: CashSessionRow[]) {
  const adminClient = createAdminClient();
  const registerIds = Array.from(new Set(sessions.map((session) => session.cash_register_id)));
  const profileIds = Array.from(
    new Set(
      sessions.flatMap((session) => [
        session.opened_by_user_id,
        session.closed_by_user_id,
      ]).filter((value): value is string => Boolean(value)),
    ),
  );

  const [{ data: registers, error: registerError }, { data: profiles }] = await Promise.all([
    registerIds.length > 0
      ? adminClient.from("cash_registers").select("id, name").in("id", registerIds)
      : Promise.resolve({ data: [] as CashRegisterRow[], error: null }),
    profileIds.length > 0
      ? adminClient.from("profiles").select("id, full_name").in("id", profileIds)
      : Promise.resolve({ data: [] as ProfileNameRow[], error: null }),
  ]);

  if (registerError) {
    throw toCashActionError(registerError, "Error al hidratar sesiones de caja");
  }

  const registerMap = new Map((registers || []).map((register) => [register.id, register.name]));
  const profileMap = buildNameMap(profiles as ProfileNameRow[] | null | undefined);

  return sessions.map((session) => mapSessionRow(session, registerMap, profileMap));
}

async function getProfileMap(profileIds: string[]) {
  const adminClient = createAdminClient();
  if (profileIds.length === 0) {
    return new Map<string, string>();
  }

  const { data } = await adminClient.from("profiles").select("id, full_name").in("id", profileIds);
  return buildNameMap(data as ProfileNameRow[] | null | undefined);
}

async function getPaymentStatusMap(paymentIds: string[]) {
  const adminClient = createAdminClient();
  if (paymentIds.length === 0) {
    return new Map<string, string | null>();
  }

  const { data, error } = await adminClient.from("payments").select("id, status").in("id", paymentIds);
  if (error) {
    throw toCashActionError(error, "Error al cargar el estado de pagos vinculados");
  }

  return new Map(
    ((data as PaymentStatusRow[] | null | undefined) || []).map((payment) => [payment.id, payment.status || null]),
  );
}

async function getProductSaleSummaryMap(productSaleIds: string[]) {
  const adminClient = createAdminClient();
  if (productSaleIds.length === 0) {
    return new Map<string, { saleNumber: string; status: string | null; itemsSummary: string | null }>();
  }

  const [{ data: sales, error: salesError }, { data: items, error: itemsError }] = await Promise.all([
    adminClient.from("product_sales").select("id, sale_number, total_amount, status").in("id", productSaleIds),
    adminClient
      .from("product_sale_items")
      .select("product_sale_id, product_name, quantity, line_total")
      .in("product_sale_id", productSaleIds)
      .order("created_at", { ascending: true }),
  ]);

  if (salesError || itemsError) {
    throw toCashActionError(salesError || itemsError, "Error al cargar ventas de productos vinculadas");
  }

  return buildProductSaleSummaryMap(
    sales as ProductSaleRow[] | null | undefined,
    items as ProductSaleItemRow[] | null | undefined,
  );
}

async function createSubscriptionPaymentWithCashFallback(params: {
  access: Awaited<ReturnType<typeof requireCashAccess>>;
  customerId: string;
  planId: number;
  startDate?: string | null;
  endDate?: string | null;
  amountOriginal?: number;
  finalPrice?: number;
  discountAmount?: number;
  graceDays?: number;
  paymentMethod: PaymentMethod;
  requireSession?: boolean;
  expireCurrentSubscription?: boolean;
}) {
  const adminClient = createAdminClient();
  const supabase = await createClient();

  if (params.requireSession) {
    await requireOperableOpenCashSession(params.access);
  }

  const { data: planRow, error: planError } = await adminClient
    .from("plans")
    .select("id, price, duration_days")
    .eq("id", params.planId)
    .single();

  if (planError || !planRow) {
    throw new Error("Plan no encontrado");
  }

  const plan = planRow as PlanFinancialRow;
  const startDate =
    params.startDate ||
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Guatemala",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const endDate =
    params.endDate ||
    (() => {
      const durationDays = Number(plan.duration_days || 30);
      const date = new Date(`${startDate}T00:00:00`);
      date.setDate(date.getDate() + durationDays);
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Guatemala",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
    })();
  const amountOriginal = params.amountOriginal ?? Number(plan.price);
  const discountAmount = Number(params.discountAmount ?? 0);
  const amountPaid = Number(params.finalPrice ?? amountOriginal - discountAmount);

  if (params.expireCurrentSubscription) {
    const { error: expireError } = await adminClient
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("user_id", params.customerId)
      .eq("status", "active");

    if (expireError) {
      throw expireError;
    }
  }

  const { data: subscriptionRow, error: subscriptionError } = await adminClient
    .from("subscriptions")
    .insert({
      user_id: params.customerId,
      plan_id: params.planId,
      start_date: startDate,
      end_date: endDate,
      status: "active",
      discount_amount: discountAmount,
      grace_days: normalizeGraceDays(params.graceDays),
    })
    .select("id")
    .single();

  if (subscriptionError || !subscriptionRow) {
    throw subscriptionError || new Error("No se pudo crear la suscripcion");
  }

  const { data: paymentRow, error: paymentError } = await adminClient
    .from("payments")
    .insert({
      subscription_id: subscriptionRow.id,
      user_id: params.customerId,
      amount_original: amountOriginal,
      discount_amount: discountAmount,
      amount_paid: amountPaid,
      method: params.paymentMethod,
      payment_date: new Date().toISOString(),
      created_by_user_id: params.access.userId,
      status: "posted",
    })
    .select("id")
    .single();

  if (paymentError || !paymentRow) {
    throw paymentError || new Error("No se pudo registrar el pago");
  }

  const { data: movementRow, error: movementError } = await supabase.rpc("attach_payment_to_cash", {
    p_payment_id: paymentRow.id,
    p_actor_user_id: params.access.userId,
    p_source_category: "membership",
    p_note: null,
  });

  if (movementError) {
    throw movementError;
  }

  return {
    subscription_id: subscriptionRow.id as string,
    payment_id: paymentRow.id as string,
    cash_movement_id: movementRow?.id ?? null,
    session_link_status: movementRow?.session_link_status ?? null,
  } satisfies PaymentRpcResult;
}

async function reverseAndRecreatePaymentWithFallback(params: {
  access: Awaited<ReturnType<typeof requireCashAccess>>;
  input: ReversePaymentInput;
}) {
  const adminClient = createAdminClient();
  const supabase = await createClient();
  const session = await requireOperableOpenCashSession(params.access);

  const { data: originalPayment, error: originalPaymentError } = await adminClient
    .from("payments")
    .select("id, subscription_id, user_id, amount_paid, method, status")
    .eq("id", params.input.paymentId)
    .single();

  if (originalPaymentError || !originalPayment) {
    throw originalPaymentError || new Error("Pago no encontrado");
  }

  if (originalPayment.status !== "posted") {
    throw new Error("Solo se pueden revertir pagos publicados");
  }

  if (!isPaymentMethod(originalPayment.method)) {
    throw new Error("El pago original no tiene un metodo valido");
  }

  const reversalCashEffect = originalPayment.method === "cash" ? (toNumber(originalPayment.amount_paid) || 0) * -1 : 0;
  const reversalNote = params.input.note?.trim() || `Reverso administrativo del pago ${params.input.paymentId}`;

  const { error: reversalMovementError } = await adminClient.from("cash_movements").insert({
    cash_session_id: session.id,
    movement_type: "void",
    category: params.input.sourceCategory ?? "membership",
    payment_method: originalPayment.method,
    amount: toNumber(originalPayment.amount_paid) || 0,
    cash_effect_amount: reversalCashEffect,
    session_link_status: "assigned",
    origin: "system",
    source_subscription_id: originalPayment.subscription_id,
    customer_id: originalPayment.user_id,
    created_by_user_id: params.access.userId,
    note: reversalNote,
  });

  if (reversalMovementError) {
    throw reversalMovementError;
  }

  const { data: replacementPayment, error: replacementPaymentError } = await adminClient
    .from("payments")
    .insert({
      subscription_id: originalPayment.subscription_id,
      user_id: originalPayment.user_id,
      amount_original: params.input.amountOriginal,
      discount_amount: params.input.discountAmount,
      amount_paid: params.input.amountPaid,
      method: params.input.paymentMethod,
      payment_date: new Date().toISOString(),
      created_by_user_id: params.access.userId,
      status: "posted",
    })
    .select("id")
    .single();

  if (replacementPaymentError || !replacementPayment) {
    throw replacementPaymentError || new Error("No se pudo crear el pago corregido");
  }

  const { error: updateOriginalPaymentError } = await adminClient
    .from("payments")
    .update({
      status: "reversed",
      reversed_at: new Date().toISOString(),
      reversed_by_user_id: params.access.userId,
      replacement_payment_id: replacementPayment.id,
      reversal_reason: params.input.reason.trim(),
    })
    .eq("id", params.input.paymentId);

  if (updateOriginalPaymentError) {
    throw updateOriginalPaymentError;
  }

  const { error: attachReplacementError } = await supabase.rpc("attach_payment_to_cash", {
    p_payment_id: replacementPayment.id,
    p_actor_user_id: params.access.userId,
    p_source_category: params.input.sourceCategory ?? "membership",
    p_note: params.input.note?.trim() || null,
  });

  if (attachReplacementError) {
    throw attachReplacementError;
  }
}

export async function getCashDashboardData(): Promise<CashDashboardData> {
  const access = await requireCashAccess();
  const adminClient = createAdminClient();

  const { data: registers, error: registerError } = await adminClient
    .from("cash_registers")
    .select("id, name, is_active, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1);

  if (registerError) {
    throw toCashActionError(registerError, "Error al cargar caja");
  }

  const register = registers?.[0] || null;

  let currentSession: CashSessionView | null = null;
  let supervisedOpenSessions: CashSessionView[] = [];
  let sessionMovements: CashMovementView[] = [];
  let summary: CashDashboardSummary | null = null;

  if (register) {
    const { data: sessionRows, error: sessionError } = await adminClient
      .from("cash_sessions")
      .select("*")
      .eq("opened_by_user_id", access.userId)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1);

    if (sessionError) {
      throw toCashActionError(sessionError, "Error al cargar sesion de caja");
    }

    const sessionRow = (sessionRows as CashSessionRow[] | null)?.[0] || null;
    if (sessionRow) {
      const [hydrated] = await hydrateSessions([sessionRow]);
      currentSession = hydrated;

      const { data: movementRows, error: movementError } = await adminClient
        .from("cash_movements")
        .select("*")
        .eq("cash_session_id", sessionRow.id)
        .order("created_at", { ascending: false });

      if (movementError) {
        throw toCashActionError(movementError, "Error al cargar movimientos de caja");
      }

      const profileIds = Array.from(
        new Set(
          ((movementRows as CashMovementRow[] | null) || []).flatMap((movement) => [
            movement.created_by_user_id,
            movement.customer_id,
          ]).filter((value): value is string => Boolean(value)),
        ),
      );
      const paymentIds = Array.from(
        new Set(
          ((movementRows as CashMovementRow[] | null) || [])
            .map((movement) => movement.source_payment_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );
      const productSaleIds = Array.from(
        new Set(
          ((movementRows as CashMovementRow[] | null) || [])
            .map((movement) => movement.source_product_sale_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );
      const profileMap = await getProfileMap(profileIds);
      const paymentStatusMap = await getPaymentStatusMap(paymentIds);
      const productSaleSummaryMap = await getProductSaleSummaryMap(productSaleIds);
      sessionMovements = mapMovementRows(
        (movementRows as CashMovementRow[] | null) || [],
        profileMap,
        paymentStatusMap,
        productSaleSummaryMap,
      );
      summary = buildCashSummary(sessionMovements, currentSession.opening_amount);
    }

    if (access.isOwner) {
      const { data: openSessionRows, error: openSessionError } = await adminClient
        .from("cash_sessions")
        .select("*")
        .eq("cash_register_id", register.id)
        .eq("status", "open")
        .neq("opened_by_user_id", access.userId)
        .order("opened_at", { ascending: false });

      if (openSessionError) {
        throw toCashActionError(openSessionError, "Error al cargar sesiones abiertas supervisadas");
      }

      supervisedOpenSessions = await hydrateSessions((openSessionRows as CashSessionRow[] | null) || []);
    }
  }

  const todayRange = getGuatemalaDateRange();
  const outOfSessionQuery = adminClient
    .from("cash_movements")
    .select("*")
    .eq("session_link_status", "out_of_session")
    .eq("created_by_user_id", access.userId)
    .gte("created_at", todayRange.start)
    .lte("created_at", todayRange.end)
    .order("created_at", { ascending: false });

  const { data: outOfSessionRows, error: outOfSessionError } = await outOfSessionQuery;
  if (outOfSessionError) {
    throw toCashActionError(outOfSessionError, "Error al cargar movimientos fuera de sesion");
  }

  const outOfSessionProfileIds = Array.from(
    new Set(
      ((outOfSessionRows as CashMovementRow[] | null) || []).flatMap((movement) => [
        movement.created_by_user_id,
        movement.customer_id,
      ]).filter((value): value is string => Boolean(value)),
    ),
  );
  const outOfSessionPaymentIds = Array.from(
    new Set(
      ((outOfSessionRows as CashMovementRow[] | null) || [])
        .map((movement) => movement.source_payment_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const outOfSessionProductSaleIds = Array.from(
    new Set(
      ((outOfSessionRows as CashMovementRow[] | null) || [])
        .map((movement) => movement.source_product_sale_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const outOfSessionProfileMap = await getProfileMap(outOfSessionProfileIds);
  const outOfSessionPaymentStatusMap = await getPaymentStatusMap(outOfSessionPaymentIds);
  const outOfSessionProductSaleSummaryMap = await getProductSaleSummaryMap(outOfSessionProductSaleIds);
  const outOfSessionMovements = mapMovementRows(
    (outOfSessionRows as CashMovementRow[] | null) || [],
    outOfSessionProfileMap,
    outOfSessionPaymentStatusMap,
    outOfSessionProductSaleSummaryMap,
  );

  const canOperateSession = Boolean(currentSession);
  const canOpenSession = !currentSession;
  const activityMovements = [...sessionMovements, ...outOfSessionMovements].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );

  return {
    access,
    register: register ? { id: register.id, name: register.name } : null,
    currentSession,
    supervisedOpenSessions,
    summary,
    sessionMovements,
    outOfSessionMovements,
    activityMovements,
    canOpenSession,
    canOperateSession,
  };
}

export async function ensureDefaultCashRegister(): Promise<EnsureCashRegisterResult> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated || !access.userId || !(access.isOwner || access.role === "admin") || !hasPermission(access, "cash.operate")) {
      return { success: false, error: "No autorizado para configurar la caja principal" };
    }

    const adminClient = createAdminClient();

    const { data: activeRegister } = await adminClient
      .from("cash_registers")
      .select("id, name")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (activeRegister) {
      revalidatePath("/panel/caja");
      return { success: true, register: { id: activeRegister.id, name: activeRegister.name } };
    }

    const { data: namedRegister } = await adminClient
      .from("cash_registers")
      .select("id, name")
      .eq("name", "Caja principal")
      .limit(1)
      .maybeSingle();

    if (namedRegister) {
      const { data: updatedRegister, error: updateError } = await adminClient
        .from("cash_registers")
        .update({ is_active: true })
        .eq("id", namedRegister.id)
        .select("id, name")
        .single();

      if (updateError || !updatedRegister) {
        return { success: false, error: updateError?.message || "No se pudo reactivar la caja principal" };
      }

      revalidatePath("/panel/caja");
      return { success: true, register: { id: updatedRegister.id, name: updatedRegister.name } };
    }

    const { data: createdRegister, error: insertError } = await adminClient
      .from("cash_registers")
      .insert({
        name: "Caja principal",
        is_active: true,
      })
      .select("id, name")
      .single();

    if (insertError || !createdRegister) {
      return { success: false, error: insertError?.message || "No se pudo crear la caja principal" };
    }

    revalidatePath("/panel/caja");
    return { success: true, register: { id: createdRegister.id, name: createdRegister.name } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo garantizar la caja principal",
    };
  }
}

export async function searchCashCustomers(search: string): Promise<CashCustomerSearchResult[]> {
  await requireOperableOpenCashSession();
  const adminClient = createAdminClient();
  const normalizedSearch = search.trim();
  let query = adminClient
    .from("customer_overview")
    .select("id, full_name, phone, plan_name, subscription_status, subscription_end_date, subscription_grace_days, subscription_access_until, is_active")
    .eq("role", "client");

  if (normalizedSearch.length > 0) {
    const escapedSearch = normalizedSearch.replace(/[,%]/g, " ").trim();
    query = query.or(`full_name.ilike.%${escapedSearch}%,phone.ilike.%${escapedSearch}%`);
  }

  const { data: customerRows, error } = await query
    .order("is_active", { ascending: false })
    .order("subscription_end_date", { ascending: true, nullsFirst: false })
    .order("full_name", { ascending: true })
    .limit(12);

  if (error) {
    throw new Error("No se pudo buscar clientes");
  }

  const customers = (customerRows as CashCustomerRow[] | null) || [];
  if (customers.length === 0) {
    return [];
  }

  const customerIds = customers.map((customer) => customer.id);
  const { data: paymentRows, error: paymentError } = await adminClient
    .from("payments")
    .select("user_id, payment_date, amount_paid, method, status")
    .in("user_id", customerIds)
    .order("payment_date", { ascending: false });

  if (paymentError) {
    throw new Error("No se pudo cargar el ultimo pago del cliente");
  }

  const latestPaymentMap = buildLatestPaymentMap(paymentRows as PaymentSummaryRow[] | null | undefined);

  return customers.map((customer) => {
    const latestPayment = latestPaymentMap.get(customer.id);
    return {
      id: customer.id,
      full_name: customer.full_name || "Cliente",
      phone: customer.phone,
      plan_name: customer.plan_name,
      subscription_status: customer.subscription_status,
      subscription_end_date: customer.subscription_end_date,
      subscription_grace_days: customer.subscription_grace_days ?? null,
      subscription_access_until: customer.subscription_access_until ?? null,
      is_active: customer.is_active !== false,
      last_payment_date: latestPayment?.payment_date || null,
      last_payment_amount: latestPayment?.amount_paid ?? null,
      last_payment_method: latestPayment?.method ?? null,
    };
  });
}

export async function getCashCustomerSummary(customerId: string): Promise<CashCustomerSummary | null> {
  await requireOperableOpenCashSession();
  const adminClient = createAdminClient();

  const [
    { data: customerRow, error: customerError },
    { data: profileRow, error: profileError },
    { data: assessmentRow, error: assessmentError },
    { data: trainingProfileRow, error: trainingProfileError },
    { data: paymentRows, error: paymentError },
  ] = await Promise.all([
    adminClient
      .from("customer_overview")
      .select("id, full_name, phone, plan_name, subscription_status, subscription_end_date, subscription_grace_days, subscription_access_until, is_active")
      .eq("role", "client")
      .eq("id", customerId)
      .maybeSingle(),
    adminClient.from("profiles").select("id, birth_date, gender, injuries, medical_notes").eq("id", customerId).maybeSingle(),
    adminClient
      .from("body_assessments")
      .select(
        "user_id, date, weight_kg, height_cm, body_type, diet_type, activity_level, body_fat_percentage, muscle_mass_kg, chest, waist, hip, arm_right, arm_left, leg_right, leg_left",
      )
      .eq("user_id", customerId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient.from("training_profiles").select("*").eq("user_id", customerId).maybeSingle(),
    adminClient
      .from("payments")
      .select("user_id, payment_date, amount_paid, method, status")
      .eq("user_id", customerId)
      .order("payment_date", { ascending: false })
      .limit(20),
  ]);

  if (customerError) {
    throw new Error("No se pudo cargar el cliente");
  }
  if (profileError) {
    throw new Error("No se pudo cargar el perfil del cliente");
  }
  if (assessmentError) {
    console.error("Cash customer summary assessment warning:", assessmentError);
  }
  if (trainingProfileError) {
    console.error("Cash customer summary training profile warning:", trainingProfileError);
  }
  if (paymentError) {
    throw new Error("No se pudo cargar el ultimo pago del cliente");
  }

  const customer = customerRow as CashCustomerRow | null;
  if (!customer) {
    return null;
  }

  const profile = profileRow as CustomerProfileRow | null;
  const assessment = assessmentRow as BodyAssessmentRow | null;
  const trainingProfile = trainingProfileRow as TrainingProfileRow | null;
  const latestPayment = buildLatestPaymentMap(paymentRows as PaymentSummaryRow[] | null | undefined).get(customerId);

  return {
    id: customer.id,
    full_name: customer.full_name || "Cliente",
    phone: customer.phone,
    plan_name: customer.plan_name,
    subscription_status: customer.subscription_status,
    subscription_end_date: customer.subscription_end_date,
    subscription_grace_days: customer.subscription_grace_days ?? null,
    subscription_access_until: customer.subscription_access_until ?? null,
    is_active: customer.is_active !== false,
    birth_date: profile?.birth_date || null,
    gender: profile?.gender || null,
    last_payment_date: latestPayment?.payment_date || null,
    last_payment_amount: latestPayment?.amount_paid ?? null,
    last_payment_method: latestPayment?.method ?? null,
    last_assessment: assessment
      ? {
          weight_kg: toNumber(assessment.weight_kg) || 0,
          height_cm: toNumber(assessment.height_cm) || 0,
          body_type: assessment.body_type || "mesomorph",
          diet_type: assessment.diet_type || undefined,
          activity_level: trainingProfile?.activity_level || assessment.activity_level || undefined,
          body_fat_percentage: toNumber(assessment.body_fat_percentage),
          muscle_mass: toNumber(assessment.muscle_mass_kg),
          chest_cm: toNumber(assessment.chest),
          waist_cm: toNumber(assessment.waist),
          hip_cm: toNumber(assessment.hip),
          arm_right_cm: toNumber(assessment.arm_right),
          arm_left_cm: toNumber(assessment.arm_left),
          leg_right_cm: toNumber(assessment.leg_right),
          leg_left_cm: toNumber(assessment.leg_left),
          injuries: profile?.injuries || undefined,
        }
      : null,
    training_profile: trainingProfile
      ? {
          primary_goal: trainingProfile.primary_goal ?? null,
          secondary_goal: trainingProfile.secondary_goal ?? null,
          focus_areas: trainingProfile.focus_areas ?? [],
          experience_level: trainingProfile.experience_level ?? null,
          days_per_week: trainingProfile.days_per_week ?? null,
          session_minutes: trainingProfile.session_minutes ?? null,
          training_location: trainingProfile.training_location ?? null,
          equipment_available: trainingProfile.equipment_available ?? [],
          activity_level: trainingProfile.activity_level ?? null,
          cardio_preference: trainingProfile.cardio_preference ?? null,
          exercise_preferences: trainingProfile.exercise_preferences ?? null,
          exercise_dislikes: trainingProfile.exercise_dislikes ?? null,
          injuries_or_pain: trainingProfile.injuries_or_pain ?? null,
          restricted_movements: trainingProfile.restricted_movements ?? [],
          parq_requires_attention: trainingProfile.parq_requires_attention ?? null,
          medical_clearance_notes: trainingProfile.medical_clearance_notes ?? profile?.medical_notes ?? null,
        }
      : null,
  };
}

export async function getCashHistoryData(filters: CashHistoryFilters = {}): Promise<CashHistoryData> {
  const access = await requireCashAccess();
  const adminClient = createAdminClient();
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const perPage = filters.perPage && filters.perPage > 0 ? filters.perPage : 10;

  let query = adminClient
    .from("cash_sessions")
    .select("*", { count: "exact" });

  if (filters.sessionNumber) {
    query = query.ilike("session_number", `%${filters.sessionNumber}%`);
  }

  const status = filters.status || "all";
  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (filters.dateFrom) {
    query = query.gte("opened_at", `${filters.dateFrom}T00:00:00${GUATEMALA_UTC_OFFSET}`);
  }

  if (filters.dateTo) {
    query = query.lte("opened_at", `${filters.dateTo}T23:59:59.999${GUATEMALA_UTC_OFFSET}`);
  }

  if (access.isOwner) {
    if (filters.openedByUserId) {
      query = query.eq("opened_by_user_id", filters.openedByUserId);
    }
  } else {
    query = query.eq("opened_by_user_id", access.userId);
  }

  const sortColumnMap: Partial<Record<string, keyof CashSessionRow>> = {
    session_number: "session_number",
    opened_at: "opened_at",
    closed_at: "closed_at",
    opening_amount: "opening_amount",
    difference_amount: "difference_amount",
    status: "status",
  };

  let hasAppliedSort = false;
  for (const sortItem of filters.sort || []) {
    const column = sortColumnMap[sortItem.id];
    if (!column) continue;

    query = query.order(column, { ascending: !sortItem.desc, nullsFirst: false });
    hasAppliedSort = true;
  }

  if (!hasAppliedSort) {
    query = query.order("opened_at", { ascending: false });
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  query = query.range(from, to);

  const { data: sessionRows, error, count } = await query;
  if (error) {
    throw toCashActionError(error, "Error al cargar historial de caja");
  }

  const sessions = await hydrateSessions((sessionRows as CashSessionRow[] | null) || []);
  let availableUsers: Array<{ id: string; name: string }> = [];

  if (access.isOwner) {
    let userQuery = adminClient.from("cash_sessions").select("opened_by_user_id");

    if (status !== "all") {
      userQuery = userQuery.eq("status", status);
    }

    if (filters.dateFrom) {
      userQuery = userQuery.gte("opened_at", `${filters.dateFrom}T00:00:00${GUATEMALA_UTC_OFFSET}`);
    }

    if (filters.dateTo) {
      userQuery = userQuery.lte("opened_at", `${filters.dateTo}T23:59:59.999${GUATEMALA_UTC_OFFSET}`);
    }

    const { data: userRows, error: userError } = await userQuery;

    if (userError) {
      throw toCashActionError(userError, "Error al cargar responsables del historial de caja");
    }

    const uniqueUserIds = Array.from(
      new Set(
        ((userRows as CashHistoryUserRow[] | null) || [])
          .map((row) => row.opened_by_user_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const profileMap = await getProfileMap(uniqueUserIds);
    availableUsers = uniqueUserIds
      .map((id) => ({ id, name: profileMap.get(id) || "Usuario" }))
      .sort((left, right) => left.name.localeCompare(right.name, "es"));
  }

  return {
    access,
    sessions,
    availableUsers,
    totalItems: count || 0,
    filters: {
      dateFrom: filters.dateFrom || "",
      dateTo: filters.dateTo || "",
      status,
      openedByUserId: access.isOwner ? filters.openedByUserId || "" : access.userId,
    },
  };
}

export async function getCashSessionDetail(sessionId: string): Promise<CashSessionDetailData> {
  const access = await requireCashAccess();
  const adminClient = createAdminClient();

  const { data: sessionRows, error: sessionError } = await adminClient
    .from("cash_sessions")
    .select("*")
    .eq("id", sessionId)
    .limit(1);

  if (sessionError) {
    throw toCashActionError(sessionError, "Error al cargar sesion");
  }

  const sessionRow = (sessionRows as CashSessionRow[] | null)?.[0];
  if (!sessionRow) {
    throw new Error("Sesión de caja no encontrada");
  }

  if (!access.isOwner && sessionRow.opened_by_user_id !== access.userId) {
    throw new Error("No autorizado para ver esta sesión");
  }

  const [session] = await hydrateSessions([sessionRow]);
  const { data: movementRows, error: movementError } = await adminClient
    .from("cash_movements")
    .select("*")
    .eq("cash_session_id", sessionId)
    .order("created_at", { ascending: false });

  if (movementError) {
    throw toCashActionError(movementError, "Error al cargar movimientos de la sesion");
  }

  const profileIds = Array.from(
    new Set(
      ((movementRows as CashMovementRow[] | null) || []).flatMap((movement) => [
        movement.created_by_user_id,
        movement.customer_id,
      ]).filter((value): value is string => Boolean(value)),
    ),
  );
  const profileMap = await getProfileMap(profileIds);
  const paymentIds = Array.from(
    new Set(
      ((movementRows as CashMovementRow[] | null) || [])
        .map((movement) => movement.source_payment_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const productSaleIds = Array.from(
    new Set(
      ((movementRows as CashMovementRow[] | null) || [])
        .map((movement) => movement.source_product_sale_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const [paymentStatusMap, productSaleSummaryMap] = await Promise.all([
    getPaymentStatusMap(paymentIds),
    getProductSaleSummaryMap(productSaleIds),
  ]);
  const movements = mapMovementRows(
    (movementRows as CashMovementRow[] | null) || [],
    profileMap,
    paymentStatusMap,
    productSaleSummaryMap,
  );
  const summary = buildCashSummary(movements, session.opening_amount);
  summary.countedAmount = session.counted_amount;
  summary.differenceAmount = session.difference_amount;
  if (session.expected_amount !== null) {
    summary.expectedAmount = session.expected_amount;
  }

  return {
    access,
    session,
    summary,
    movements,
  };
}

export async function openCashSession(registerId: string, openingAmount: number, notes?: string) {
  await requireCashAccess();
  const supabase = await createClient();

  const { error } = await supabase.rpc("open_cash_session", {
    p_register_id: registerId,
    p_opening_amount: openingAmount,
    p_notes: notes?.trim() || null,
  });

  if (error) {
    throw toCashActionError(error, "No se pudo abrir caja");
  }

  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
}

export async function closeCashSession(
  sessionId: string,
  countedAmount: number,
  notes?: string,
  adminPassword?: string,
) {
  const access = await requireCashAccess();
  const authorization = await resolveCashCloseAuthorizer({ access, adminPassword });
  const supabase = createAdminClient();

  const { error } = await supabase.rpc("close_cash_session", {
    p_session_id: sessionId,
    p_counted_amount: countedAmount,
    p_notes: notes?.trim() || null,
    p_requested_by_user_id: authorization.requestedByUserId,
    p_closed_by_user_id: authorization.closedByUserId,
  });

  if (error) {
    throw toCashActionError(error, "No se pudo cerrar caja");
  }

  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
  revalidatePath(`/panel/caja/historial/${sessionId}`);
  revalidatePath("/panel/pagos");
  revalidatePath("/panel/resumen");
}

export async function runCreateSubscriptionPaymentForExistingCustomer(params: {
  customerId: string;
  planId?: number;
  startDate?: string | null;
  endDate?: string | null;
  amountOriginal?: number;
  finalPrice?: number;
  discountAmount?: number;
  graceDays?: number;
  paymentMethod?: PaymentMethod;
  requireSession?: boolean;
}) {
  const access = await requireCashAccess();
  if (params.requireSession) {
    await requireOperableOpenCashSession(access);
  }

  if (params.planId && params.amountOriginal !== undefined) {
    const fallbackData = await createSubscriptionPaymentWithCashFallback({
      access,
      customerId: params.customerId,
      planId: params.planId,
      startDate: params.startDate,
      endDate: params.endDate,
      amountOriginal: params.amountOriginal,
      finalPrice: params.finalPrice,
      discountAmount: params.discountAmount,
      graceDays: params.graceDays,
      paymentMethod: params.paymentMethod ?? "cash",
      requireSession: params.requireSession,
    });

    revalidatePath("/panel/caja");
    revalidatePath("/panel/caja/historial");
    revalidatePath("/panel/pagos");
    revalidatePath("/panel/resumen");

    return fallbackData;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_subscription_payment_for_existing_customer", {
    p_customer_id: params.customerId,
    p_plan_id: params.planId ?? null,
    p_start_date: params.startDate ?? null,
    p_end_date: params.endDate ?? null,
    p_final_price: params.finalPrice ?? null,
    p_discount_amount: params.discountAmount ?? 0,
    p_grace_days: normalizeGraceDays(params.graceDays),
    p_payment_method: params.paymentMethod ?? "cash",
    p_created_by_user_id: access.userId,
  });

  if (error) {
    if (isPaymentMethodEnumTypeMismatch(error) && params.planId) {
      const fallbackData = await createSubscriptionPaymentWithCashFallback({
        access,
        customerId: params.customerId,
        planId: params.planId,
        startDate: params.startDate,
        endDate: params.endDate,
        finalPrice: params.finalPrice,
        discountAmount: params.discountAmount,
        graceDays: params.graceDays,
        paymentMethod: params.paymentMethod ?? "cash",
        requireSession: params.requireSession,
      });

      revalidatePath("/panel/caja");
      revalidatePath("/panel/caja/historial");
      revalidatePath("/panel/pagos");
      revalidatePath("/panel/resumen");

      return fallbackData;
    }

    throw toCashActionError(error, "No se pudo registrar la suscripcion con pago");
  }

  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
  revalidatePath("/panel/pagos");
  revalidatePath("/panel/resumen");

  return (data || null) as PaymentRpcResult | null;
}

export async function runRenewSubscriptionWithPayment(params: {
  customerId: string;
  planId: number;
  startDate: string;
  endDate: string;
  price: number;
  discountAmount: number;
  graceDays?: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  requireSession?: boolean;
}) {
  const access = await requireCashAccess();
  if (params.requireSession) {
    await requireOperableOpenCashSession(access);
  }
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("renew_subscription_with_payment", {
    p_customer_id: params.customerId,
    p_plan_id: params.planId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_price: params.price,
    p_discount_amount: params.discountAmount,
    p_grace_days: normalizeGraceDays(params.graceDays),
    p_amount_paid: params.amountPaid,
    p_payment_method: params.paymentMethod,
    p_created_by_user_id: access.userId,
  });

  if (error) {
    if (isPaymentMethodEnumTypeMismatch(error)) {
      const fallbackData = await createSubscriptionPaymentWithCashFallback({
        access,
        customerId: params.customerId,
        planId: params.planId,
        startDate: params.startDate,
        endDate: params.endDate,
        amountOriginal: params.price,
        finalPrice: params.amountPaid,
        discountAmount: params.discountAmount,
        graceDays: params.graceDays,
        paymentMethod: params.paymentMethod,
        requireSession: params.requireSession,
        expireCurrentSubscription: true,
      });

      revalidatePath("/panel/caja");
      revalidatePath("/panel/caja/historial");
      revalidatePath("/panel/pagos");
      revalidatePath("/panel/resumen");

      return fallbackData;
    }

    throw toCashActionError(error, "No se pudo renovar la suscripcion");
  }

  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
  revalidatePath("/panel/pagos");
  revalidatePath("/panel/resumen");

  return (data || null) as PaymentRpcResult | null;
}

export async function getPaymentReversalContext(paymentId: string): Promise<CashPaymentReversalContext | null> {
  await requireCashAccess();

  const adminClient = createAdminClient();
  const { data: paymentRow, error: paymentError } = await adminClient
    .from("payments")
    .select("id, user_id, subscription_id, amount_original, discount_amount, amount_paid, method, payment_date, status")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError) {
    throw toCashActionError(paymentError, "No se pudo cargar el contexto del pago");
  }

  if (!paymentRow) {
    return null;
  }

  if (!isPaymentMethod(paymentRow.method)) {
    throw new Error("El pago no tiene un metodo valido para reverso");
  }

  const [{ data: profileRow, error: profileError }, { data: subscriptionRow, error: subscriptionError }] = await Promise.all([
    adminClient.from("profiles").select("id, full_name").eq("id", paymentRow.user_id).maybeSingle(),
    paymentRow.subscription_id
      ? adminClient.from("subscriptions").select("id, plan_id").eq("id", paymentRow.subscription_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (profileError) {
    throw toCashActionError(profileError, "No se pudo cargar el cliente del pago");
  }

  if (subscriptionError) {
    throw toCashActionError(subscriptionError, "No se pudo cargar la suscripcion del pago");
  }

  let planName: string | null = null;
  const planId =
    subscriptionRow && typeof subscriptionRow === "object" && "plan_id" in subscriptionRow
      ? subscriptionRow.plan_id
      : null;

  if (typeof planId === "number") {
    const { data: planRow, error: planError } = await adminClient.from("plans").select("name").eq("id", planId).maybeSingle();
    if (planError) {
      throw toCashActionError(planError, "No se pudo cargar el plan del pago");
    }

    planName = planRow?.name || null;
  }

  return {
    payment_id: paymentRow.id,
    user_id: paymentRow.user_id,
    user_name: profileRow?.full_name || "Cliente",
    subscription_id: paymentRow.subscription_id,
    plan_name: planName,
    amount_original: toNumber(paymentRow.amount_original) || 0,
    discount_amount: toNumber(paymentRow.discount_amount) || 0,
    amount_paid: toNumber(paymentRow.amount_paid) || 0,
    method: paymentRow.method,
    payment_date: paymentRow.payment_date,
    status: paymentRow.status || null,
  };
}

export async function reverseAndRecreatePayment(input: ReversePaymentInput) {
  const access = await requireCashAccess();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reverse_and_recreate_payment", {
    p_payment_id: input.paymentId,
    p_amount_original: input.amountOriginal,
    p_discount_amount: input.discountAmount,
    p_amount_paid: input.amountPaid,
    p_payment_method: input.paymentMethod,
    p_reason: input.reason.trim(),
    p_source_category: input.sourceCategory ?? "membership",
    p_note: input.note?.trim() || null,
    p_actor_user_id: access.userId,
  });

  if (error) {
    if (isPaymentMethodEnumTypeMismatch(error)) {
      await reverseAndRecreatePaymentWithFallback({ access, input });

      revalidatePath("/panel/caja");
      revalidatePath("/panel/caja/historial");
      revalidatePath("/panel/pagos");
      revalidatePath("/panel/resumen");

      return {
        reversed_payment_id: input.paymentId,
        replacement_payment_id: null,
      };
    }

    throw toCashActionError(error, "No se pudo revertir el pago");
  }

  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
  revalidatePath("/panel/pagos");
  revalidatePath("/panel/resumen");

  return data;
}

export async function searchCashProducts(search: string): Promise<CashProductSearchResult[]> {
  await requireOperableOpenCashSession();
  const access = await requireCashAccess();
  if (!access.isOwner && !access.permissions.includes("inventory.sell")) {
    throw new Error("No autorizado para vender productos");
  }

  const adminClient = createAdminClient();
  const normalizedSearch = search.trim();
  let query = adminClient
    .from("product_inventory_overview")
    .select("id, name, sku, barcode, image_url, sale_price, stock_quantity, is_active")
    .eq("is_active", true);

  if (normalizedSearch.length > 0) {
    const escapedSearch = normalizedSearch.replace(/[,%]/g, " ").trim();
    query = query.or(`name.ilike.%${escapedSearch}%,sku.ilike.%${escapedSearch}%,barcode.ilike.%${escapedSearch}%`);
  }

  const { data, error } = await query.order("name", { ascending: true }).limit(12);

  if (error) {
    throw toCashActionError(error, "No se pudieron buscar productos");
  }

  return ((data as ProductInventoryRow[] | null) || []).map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    image_url: product.image_url,
    sale_price: toNumber(product.sale_price) || 0,
    stock_quantity: toNumber(product.stock_quantity) || 0,
    is_active: product.is_active,
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

  const rpcItems = params.items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sell_products_from_cash_session", {
    p_items: rpcItems,
    p_payment_method: params.paymentMethod,
    p_note: params.note?.trim() || null,
  });

  if (error) {
    throw toCashActionError(error, "No se pudo vender productos");
  }

  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
  revalidatePath("/panel/inventario/productos");
  revalidatePath("/panel/inventario/movimientos");
  revalidatePath("/panel/resumen");

  const result = (data || {}) as Partial<CashProductSaleResult>;
  return {
    product_sale_id: String(result.product_sale_id || ""),
    sale_number: String(result.sale_number || ""),
    cash_movement_id: String(result.cash_movement_id || ""),
    total_amount: Number(result.total_amount || 0),
  };
}

export async function voidProductSaleFromCashSession(params: {
  productSaleId: string;
  note?: string | null;
}): Promise<CashProductSaleVoidResult> {
  const access = await requireCashAccess();
  await requireOperableOpenCashSession(access);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("void_product_sale_from_cash_session", {
    p_product_sale_id: params.productSaleId,
    p_note: params.note?.trim() || null,
  });

  if (error) {
    throw toCashActionError(error, "No se pudo anular la venta");
  }

  revalidatePath("/panel/caja");
  revalidatePath("/panel/caja/historial");
  revalidatePath("/panel/inventario/productos");
  revalidatePath("/panel/inventario/movimientos");
  revalidatePath("/panel/resumen");

  const result = (data || {}) as Partial<CashProductSaleVoidResult>;
  return {
    product_sale_id: String(result.product_sale_id || ""),
    cash_movement_id: String(result.cash_movement_id || ""),
    inventory_movement_count: Number(result.inventory_movement_count || 0),
  };
}
