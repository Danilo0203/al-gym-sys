/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createClientAdmin } from "@supabase/supabase-js";
import { getUserEmail } from "@/lib/supabase/admin";
import { computeFitnessPlan } from "@/lib/fitness/excel-calculator";
import type { ActivityLevel, BodyType, DietType } from "@/lib/fitness/types";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { runPaymentsPostedQueryCompat } from "@/lib/payments/schema-compat";
import { isCashModuleNotReadyError } from "@/features/cash/lib/cash-module-errors";
import {
  runCreateSubscriptionPaymentForExistingCustomer,
  runRenewSubscriptionWithPayment,
} from "@/features/cash/actions/cash-actions";
import { syncTrainingProfileWithAdmin } from "@/features/customers/actions/customer-routine-actions";
import { DEFAULT_EQUIPMENT_AVAILABLE, DEFAULT_TRAINING_LOCATION } from "@/lib/training/profile-defaults";
import type { NutritionContext, TrainingProfileInput } from "@/lib/training/types";
import { normalizeAuthEmail, normalizeGuatemalaPhoneForAuth } from "@/lib/auth/identifiers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
type AdminSupabaseClient = any;
type PaymentMethod = "cash" | "card" | "transfer";
type DeviceSyncMethod = "direct" | "queue" | "none";
type DeviceSyncAction = "enable" | "disable" | "delete";
type DeviceSyncResult = {
  attempted: boolean;
  action?: DeviceSyncAction;
  synced?: boolean;
  queued?: boolean;
  method?: DeviceSyncMethod;
  reason?: string;
  error?: string;
};
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DEFAULT_ZK_DEVICE_SN = (process.env.DEFAULT_ZK_DEVICE_SN || "").trim();
const GYM_SYNC_SERVER_URL = (process.env.GYM_SYNC_SERVER_URL || "http://127.0.0.1:8080").trim();
const GYM_SYNC_API_TOKEN = (process.env.GYM_SYNC_API_TOKEN || "").trim();
const ZK_DEFAULT_USER_GROUP = Number(process.env.ZK_DEFAULT_USER_GROUP || 1);
const ZK_DEFAULT_AUTHORIZE_TIMEZONE_ID = Number(process.env.ZK_DEFAULT_AUTHORIZE_TIMEZONE_ID || 1);
const ZK_DEFAULT_AUTHORIZE_DOOR_ID = Number(process.env.ZK_DEFAULT_AUTHORIZE_DOOR_ID || 1);

function normalizeZkUserName(fullName: string | null | undefined, biometricId: number | string) {
  return (
    (fullName || `USER${biometricId}`)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || `USER${biometricId}`
  );
}

function sanitizeZkFieldValue(value: string | null | undefined, max = 64) {
  return String(value || "")
    .replace(/[\t\r\n=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function buildZkDataUserCommand(params: { biometricId: number | string; fullName?: string | null }) {
  const displayName =
    sanitizeZkFieldValue(params.fullName, 24) || normalizeZkUserName(params.fullName, params.biometricId);

  // SpeedFace/H5L usa el formato del protocolo de seguridad: CardNo/Pin/Password/Group/StartTime/EndTime/Name/Privilege.
  // Evitamos tanto USERINFO (-629 en este firmware) como los payloads viejos mal interpretados por el equipo.
  return (
    `DATA UPDATE user ` +
    `CardNo=\t` +
    `Pin=${params.biometricId}\t` +
    `Password=\t` +
    `Group=${ZK_DEFAULT_USER_GROUP}\t` +
    `StartTime=0\t` +
    `EndTime=0\t` +
    `Name=${displayName}\t` +
    `Privilege=0`
  );
}

function buildZkUserAuthorizeCommand(params: { biometricId: number | string }) {
  return (
    `DATA UPDATE userauthorize ` +
    `Pin=${params.biometricId}\t` +
    `AuthorizeTimezoneId=${ZK_DEFAULT_AUTHORIZE_TIMEZONE_ID}\t` +
    `AuthorizeDoorId=${ZK_DEFAULT_AUTHORIZE_DOOR_ID}`
  );
}

function buildZkUserDisableCommand(params: { biometricId: number | string }) {
  return `DATA DELETE userauthorize Pin=${params.biometricId}`;
}

function buildZkUserDeleteCommands(params: { biometricId: number | string }) {
  const commands = [buildZkUserDisableCommand(params)];

  for (let fingerId = 0; fingerId <= 9; fingerId += 1) {
    commands.push(`DATA DELETE templatev10 Pin=${params.biometricId}\tFingerID=${fingerId}`);
  }

  commands.push(`DATA DELETE user Pin=${params.biometricId}`);
  return commands;
}

function normalizeDeviceSyncMethod(value: unknown): DeviceSyncMethod {
  return value === "direct" || value === "queue" || value === "none" ? value : "none";
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeOptionalEmail(value: unknown) {
  return typeof value === "string" ? normalizeAuthEmail(value) ?? undefined : undefined;
}

function normalizeNullableText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return undefined;
  const normalized = typeof value === "number" ? value : Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function normalizeOptionalInteger(value: unknown) {
  const normalized = normalizeOptionalNumber(value);
  return typeof normalized === "number" ? Math.trunc(normalized) : undefined;
}

function todayDateString() {
  return new Date().toISOString().split("T")[0];
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "cash" || value === "card" || value === "transfer";
}

function addDaysToIsoDate(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatToLocalISO(date) || dateString;
}

function resolveSubscriptionStatus(endDate: string) {
  return endDate < todayDateString() ? "expired" : "active";
}

function hasMembershipPayload(data: Partial<CreateCustomerData>) {
  return (
    data.plan_id !== undefined ||
    data.start_date !== undefined ||
    data.end_date !== undefined ||
    data.discount_amount !== undefined ||
    data.payment_method !== undefined ||
    data.final_price !== undefined
  );
}

interface MembershipSnapshot {
  subscription: {
    id: string;
    plan_id: number | null;
    start_date: string | null;
    end_date: string | null;
    discount_amount: number | null;
    status: string | null;
  } | null;
  payment: {
    id: string;
    amount_original: number | null;
    discount_amount: number | null;
    amount_paid: number | null;
    method: string | null;
    status: string | null;
  } | null;
}

interface MembershipPaymentRow {
  id: string;
  amount_original: number | string | null;
  discount_amount: number | string | null;
  amount_paid: number | string | null;
  method: string | null;
  status: string | null;
}

async function getLatestMembershipSnapshot(client: AdminSupabaseClient, customerId: string): Promise<MembershipSnapshot> {
  let subscription =
    (await client
      .from("subscriptions")
      .select("id, plan_id, start_date, end_date, discount_amount, status")
      .eq("user_id", customerId)
      .eq("status", "active")
      .order("end_date", { ascending: false, nullsFirst: false })
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()).data || null;

  if (!subscription) {
    subscription =
      (await client
        .from("subscriptions")
        .select("id, plan_id, start_date, end_date, discount_amount, status")
        .eq("user_id", customerId)
        .order("end_date", { ascending: false, nullsFirst: false })
        .order("start_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()).data || null;
  }

  if (!subscription) {
    return { subscription: null, payment: null };
  }

  const { data: payment } = await runPaymentsPostedQueryCompat((usePostedFilter) => {
    let query = client
      .from("payments")
      .select("id, amount_original, discount_amount, amount_paid, method, status")
      .eq("subscription_id", subscription.id)
      .order("payment_date", { ascending: false })
      .limit(1);

    if (usePostedFilter) {
      query = query.eq("status", "posted");
    }

    return query.maybeSingle();
  });

  const typedPayment = payment as MembershipPaymentRow | null;

  return {
    subscription,
    payment: typedPayment
      ? {
          id: String(typedPayment.id),
          amount_original: typeof typedPayment.amount_original === "number" ? typedPayment.amount_original : Number(typedPayment.amount_original ?? 0),
          discount_amount:
            typeof typedPayment.discount_amount === "number" ? typedPayment.discount_amount : Number(typedPayment.discount_amount ?? 0),
          amount_paid: typeof typedPayment.amount_paid === "number" ? typedPayment.amount_paid : Number(typedPayment.amount_paid ?? 0),
          method: typeof typedPayment.method === "string" ? typedPayment.method : null,
          status: typeof typedPayment.status === "string" ? typedPayment.status : null,
        }
      : null,
  };
}

async function findOpenCashSessionForUser(adminClient: AdminSupabaseClient, userId: string) {
  const { data } = await adminClient
    .from("cash_sessions")
    .select("id")
    .eq("opened_by_user_id", userId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

async function attachPaymentToCashWithAdmin(params: {
  adminClient: AdminSupabaseClient;
  paymentId: string;
  actorUserId: string;
  note?: string | null;
}) {
  const { data: existingMovement } = await params.adminClient
    .from("cash_movements")
    .select("id")
    .eq("source_payment_id", params.paymentId)
    .maybeSingle();

  if (existingMovement) {
    return existingMovement;
  }

  const { data: paymentRow } = await params.adminClient
    .from("payments")
    .select("id, subscription_id, user_id, amount_paid, method, status")
    .eq("id", params.paymentId)
    .single();

  if (!paymentRow || paymentRow.status !== "posted" || !isPaymentMethod(paymentRow.method)) {
    return null;
  }

  const session = await findOpenCashSessionForUser(params.adminClient, params.actorUserId);
  const amountPaid = Number(paymentRow.amount_paid || 0);
  const cashEffectAmount = paymentRow.method === "cash" ? amountPaid : 0;

  const { data: movement } = await params.adminClient
    .from("cash_movements")
    .insert({
      cash_session_id: session?.id ?? null,
      movement_type: "sale",
      category: "membership",
      payment_method: paymentRow.method,
      amount: amountPaid,
      cash_effect_amount: cashEffectAmount,
      session_link_status: session?.id ? "assigned" : "out_of_session",
      origin: "system",
      source_payment_id: paymentRow.id,
      source_subscription_id: paymentRow.subscription_id,
      customer_id: paymentRow.user_id,
      created_by_user_id: params.actorUserId,
      note: params.note?.trim() || null,
    })
    .select("id")
    .single();

  return movement || null;
}

async function reverseAndRecreatePaymentWithAdmin(params: {
  adminClient: AdminSupabaseClient;
  actorUserId: string;
  paymentId: string;
  amountOriginal: number;
  discountAmount: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  note?: string | null;
}) {
  const { data: originalPayment, error: originalPaymentError } = await params.adminClient
    .from("payments")
    .select("id, subscription_id, user_id, amount_paid, method, status")
    .eq("id", params.paymentId)
    .single();

  if (originalPaymentError || !originalPayment) {
    throw originalPaymentError || new Error("Pago no encontrado");
  }

  if (originalPayment.status !== "posted" || !isPaymentMethod(originalPayment.method)) {
    throw new Error("Solo se pueden corregir pagos publicados");
  }

  const session = await findOpenCashSessionForUser(params.adminClient, params.actorUserId);
  const reversalAmount = Number(originalPayment.amount_paid || 0);
  const reversalCashEffect = originalPayment.method === "cash" ? reversalAmount * -1 : 0;
  const reversalReason = "Corrección administrativa desde edición de cliente";

  const { error: reversalMovementError } = await params.adminClient.from("cash_movements").insert({
    cash_session_id: session?.id ?? null,
    movement_type: "void",
    category: "membership",
    payment_method: originalPayment.method,
    amount: reversalAmount,
    cash_effect_amount: reversalCashEffect,
    session_link_status: session?.id ? "assigned" : "out_of_session",
    origin: "system",
    source_subscription_id: originalPayment.subscription_id,
    customer_id: originalPayment.user_id,
    created_by_user_id: params.actorUserId,
    note: params.note?.trim() || `Reverso administrativo del pago ${params.paymentId}`,
  });

  if (reversalMovementError) {
    throw reversalMovementError;
  }

  const { data: replacementPayment, error: replacementPaymentError } = await params.adminClient
    .from("payments")
    .insert({
      subscription_id: originalPayment.subscription_id,
      user_id: originalPayment.user_id,
      amount_original: params.amountOriginal,
      discount_amount: params.discountAmount,
      amount_paid: params.amountPaid,
      method: params.paymentMethod,
      payment_date: new Date().toISOString(),
      created_by_user_id: params.actorUserId,
      status: "posted",
    })
    .select("id")
    .single();

  if (replacementPaymentError || !replacementPayment) {
    throw replacementPaymentError || new Error("No se pudo crear el pago corregido");
  }

  const { error: updateOriginalPaymentError } = await params.adminClient
    .from("payments")
    .update({
      status: "reversed",
      reversed_at: new Date().toISOString(),
      reversed_by_user_id: params.actorUserId,
      replacement_payment_id: replacementPayment.id,
      reversal_reason: reversalReason,
    })
    .eq("id", params.paymentId);

  if (updateOriginalPaymentError) {
    throw updateOriginalPaymentError;
  }

  await attachPaymentToCashWithAdmin({
    adminClient: params.adminClient,
    paymentId: replacementPayment.id,
    actorUserId: params.actorUserId,
    note: params.note,
  });

  return replacementPayment.id as string;
}

async function upsertMembershipForCustomer(params: {
  adminClient: AdminSupabaseClient;
  actorUserId: string;
  customerId: string;
  data: Partial<CreateCustomerData>;
}) {
  if (!hasMembershipPayload(params.data)) {
    return;
  }

  const snapshot = await getLatestMembershipSnapshot(params.adminClient, params.customerId);
  const targetPlanId = params.data.plan_id ?? snapshot.subscription?.plan_id ?? null;

  if (!targetPlanId) {
    return;
  }

  const { data: planRow, error: planError } = await params.adminClient
    .from("plans")
    .select("id, price, duration_days")
    .eq("id", targetPlanId)
    .single();

  if (planError || !planRow) {
    throw planError || new Error("Plan no encontrado");
  }

  const startDate =
    formatToLocalISO(params.data.start_date) ?? snapshot.subscription?.start_date ?? todayDateString();
  const endDate =
    formatToLocalISO(params.data.end_date) ??
    snapshot.subscription?.end_date ??
    addDaysToIsoDate(startDate, Number(planRow.duration_days || 30));
  const discountAmount = Number(params.data.discount_amount ?? snapshot.subscription?.discount_amount ?? 0);
  const amountOriginal = Number(planRow.price || 0);
  const amountPaid = Number(params.data.final_price ?? Math.max(0, amountOriginal - discountAmount));
  const paymentMethod = isPaymentMethod(params.data.payment_method)
    ? params.data.payment_method
    : isPaymentMethod(snapshot.payment?.method)
      ? snapshot.payment.method
      : "cash";
  const status = resolveSubscriptionStatus(endDate);

  if (!snapshot.subscription) {
    const { data: subscriptionRow, error: subscriptionError } = await params.adminClient
      .from("subscriptions")
      .insert({
        user_id: params.customerId,
        plan_id: targetPlanId,
        start_date: startDate,
        end_date: endDate,
        status,
        discount_amount: discountAmount,
      })
      .select("id")
      .single();

    if (subscriptionError || !subscriptionRow) {
      throw subscriptionError || new Error("No se pudo crear la suscripción");
    }

    const { data: paymentRow, error: paymentError } = await params.adminClient
      .from("payments")
      .insert({
        subscription_id: subscriptionRow.id,
        user_id: params.customerId,
        amount_original: amountOriginal,
        discount_amount: discountAmount,
        amount_paid: amountPaid,
        method: paymentMethod,
        payment_date: new Date().toISOString(),
        created_by_user_id: params.actorUserId,
        status: "posted",
      })
      .select("id")
      .single();

    if (paymentError || !paymentRow) {
      throw paymentError || new Error("No se pudo crear el pago");
    }

    await attachPaymentToCashWithAdmin({
      adminClient: params.adminClient,
      paymentId: paymentRow.id,
      actorUserId: params.actorUserId,
      note: "Alta de membresía desde edición de cliente",
    });

    return;
  }

  const subscriptionChanged =
    snapshot.subscription.plan_id !== targetPlanId ||
    snapshot.subscription.start_date !== startDate ||
    snapshot.subscription.end_date !== endDate ||
    Number(snapshot.subscription.discount_amount ?? 0) !== discountAmount ||
    snapshot.subscription.status !== status;

  if (subscriptionChanged) {
    const { error: subscriptionUpdateError } = await params.adminClient
      .from("subscriptions")
      .update({
        plan_id: targetPlanId,
        start_date: startDate,
        end_date: endDate,
        status,
        discount_amount: discountAmount,
      })
      .eq("id", snapshot.subscription.id);

    if (subscriptionUpdateError) {
      throw subscriptionUpdateError;
    }
  }

  if (!snapshot.payment) {
    const { data: paymentRow, error: paymentError } = await params.adminClient
      .from("payments")
      .insert({
        subscription_id: snapshot.subscription.id,
        user_id: params.customerId,
        amount_original: amountOriginal,
        discount_amount: discountAmount,
        amount_paid: amountPaid,
        method: paymentMethod,
        payment_date: new Date().toISOString(),
        created_by_user_id: params.actorUserId,
        status: "posted",
      })
      .select("id")
      .single();

    if (paymentError || !paymentRow) {
      throw paymentError || new Error("No se pudo crear el pago");
    }

    await attachPaymentToCashWithAdmin({
      adminClient: params.adminClient,
      paymentId: paymentRow.id,
      actorUserId: params.actorUserId,
      note: "Pago agregado desde edición de cliente",
    });

    return;
  }

  const paymentChanged =
    Number(snapshot.payment.amount_original ?? 0) !== amountOriginal ||
    Number(snapshot.payment.discount_amount ?? 0) !== discountAmount ||
    Number(snapshot.payment.amount_paid ?? 0) !== amountPaid ||
    snapshot.payment.method !== paymentMethod;

  if (paymentChanged) {
    await reverseAndRecreatePaymentWithAdmin({
      adminClient: params.adminClient,
      actorUserId: params.actorUserId,
      paymentId: snapshot.payment.id,
      amountOriginal,
      discountAmount,
      amountPaid,
      paymentMethod,
      note: "Corrección de pago desde edición de cliente",
    });
  }
}

function normalizeCustomerPayload<T extends Partial<CreateCustomerData>>(data: T): T {
  return {
    ...data,
    email: normalizeOptionalEmail(data.email),
    plan_id: normalizeOptionalInteger(data.plan_id),
    final_price: normalizeOptionalNumber(data.final_price),
    discount_amount: normalizeOptionalNumber(data.discount_amount),
    days_per_week: normalizeOptionalInteger(data.days_per_week),
    session_minutes: normalizeOptionalInteger(data.session_minutes),
    weight_kg: normalizeOptionalNumber(data.weight_kg),
    height_cm: normalizeOptionalNumber(data.height_cm),
    body_fat_percentage: normalizeOptionalNumber(data.body_fat_percentage),
    muscle_mass_kg: normalizeOptionalNumber(data.muscle_mass_kg),
    chest: normalizeOptionalNumber(data.chest),
    waist: normalizeOptionalNumber(data.waist),
    hip: normalizeOptionalNumber(data.hip),
    arm_right: normalizeOptionalNumber(data.arm_right),
    arm_left: normalizeOptionalNumber(data.arm_left),
    leg_right: normalizeOptionalNumber(data.leg_right),
    leg_left: normalizeOptionalNumber(data.leg_left),
  } as T;
}

async function getCustomerDeviceProfile(adminClient: AdminSupabaseClient, customerId: string) {
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("biometric_id, full_name, is_active")
    .eq("id", customerId)
    .single();

  if (profileError || !profile) {
    return { ok: false as const, reason: "profile_not_found" as const, error: profileError?.message };
  }

  const typedProfile = profile as {
    biometric_id?: number | string | null;
    full_name?: string | null;
    is_active?: boolean | null;
  } | null;
  if (!typedProfile?.biometric_id) {
    return { ok: false as const, reason: "missing_biometric_id" as const };
  }

  return {
    ok: true as const,
    biometricId: typedProfile.biometric_id,
    fullName: typedProfile.full_name,
    isActive: typedProfile.is_active !== false,
  };
}

async function expirePastDueSubscriptionsForCustomer(adminClient: AdminSupabaseClient, customerId: string) {
  const { error } = await adminClient
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("user_id", customerId)
    .eq("status", "active")
    .lt("end_date", todayDateString());

  if (error) {
    console.error(`Error expiring overdue subscriptions for customer ${customerId}:`, error);
  }
}

async function customerHasActiveSubscription(adminClient: AdminSupabaseClient, customerId: string) {
  const { data, error } = await adminClient
    .from("subscriptions")
    .select("id, end_date")
    .eq("user_id", customerId)
    .eq("status", "active")
    .order("end_date", { ascending: false, nullsFirst: false });

  if (error) {
    console.error(`Error checking active subscription for customer ${customerId}:`, error);
    return false;
  }

  const today = todayDateString();
  return (data || []).some((subscription: { end_date?: string | null }) => !subscription.end_date || subscription.end_date >= today);
}

async function queueZkCommands(params: {
  adminClient: AdminSupabaseClient;
  customerId: string;
  deviceSn: string;
  buildCommands: (profile: { biometricId: number | string; fullName?: string | null }) => string[];
}) {
  const profile = await getCustomerDeviceProfile(params.adminClient, params.customerId);
  if (!profile.ok) {
    return { queued: false, reason: profile.reason, error: profile.error };
  }

  const commands = params
    .buildCommands({
      biometricId: profile.biometricId,
      fullName: profile.fullName,
    })
    .filter(Boolean);

  if (commands.length === 0) {
    return { queued: false, reason: "missing_commands" as const };
  }

  const rows = commands.map((command) => ({
    device_id: params.deviceSn,
    command,
    executed: false,
  }));

  const { error: insertError } = await params.adminClient.from("device_commands").insert(rows);
  if (insertError) {
    return { queued: false, reason: "insert_error" as const, error: insertError.message };
  }

  return {
    queued: true as const,
    biometricId: profile.biometricId,
    fullName: profile.fullName,
    queuedCommands: commands,
  };
}

async function queueZkUserSync(params: {
  adminClient: AdminSupabaseClient;
  customerId: string;
  deviceSn: string;
  autoEnrollFace?: boolean;
}) {
  const queued = await queueZkCommands({
    adminClient: params.adminClient,
    customerId: params.customerId,
    deviceSn: params.deviceSn,
    buildCommands: (profile) => {
      const commands = [
        buildZkDataUserCommand({
          biometricId: profile.biometricId,
          fullName: profile.fullName,
        }),
        buildZkUserAuthorizeCommand({
          biometricId: profile.biometricId,
        }),
      ];

      if (params.autoEnrollFace) {
        commands.push(`ENROLL_USER PIN=${profile.biometricId} Backup=0`);
      }

      return commands;
    },
  });

  if (!queued.queued) {
    return queued;
  }

  const queuedCommands = queued.queuedCommands || [];

  return {
    queued: true as const,
    biometricId: queued.biometricId,
    command: queuedCommands[0],
    queuedCommands,
  };
}

async function callGymSyncServer(pathname: string, body: Record<string, unknown>) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (GYM_SYNC_API_TOKEN) {
    headers.Authorization = `Bearer ${GYM_SYNC_API_TOKEN}`;
  }

  try {
    const response = await fetch(new URL(pathname, GYM_SYNC_SERVER_URL).toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    let result: Record<string, unknown> | null = null;
    try {
      result = await response.json();
    } catch {}

    if (!response.ok) {
      return {
        attempted: true,
        synced: false,
        queued: false,
        method: normalizeDeviceSyncMethod(result?.method),
        reason: normalizeOptionalString(result?.error) || `http_${response.status}`,
        error: normalizeOptionalString(result?.details) || normalizeOptionalString(result?.error),
      } satisfies DeviceSyncResult;
    }

    return {
      attempted: true,
      synced: result?.success === true,
      queued: result?.success === true,
      method: normalizeDeviceSyncMethod(result?.method),
      reason: undefined,
      error: undefined,
    } satisfies DeviceSyncResult;
  } catch (error) {
    return {
      attempted: true,
      synced: false,
      queued: false,
      method: "none" as const,
      reason: "sync_server_unreachable",
      error: error instanceof Error ? error.message : "sync_server_unreachable",
    } satisfies DeviceSyncResult;
  }
}

async function syncCustomerWithGymSyncServer(params: { customerId: string; deviceSn: string }) {
  return callGymSyncServer("/api/device-users/register", {
    customer_id: params.customerId,
    device_id: params.deviceSn,
  });
}

async function disableCustomerOnGymSyncServer(params: { customerId: string; deviceSn: string }) {
  return callGymSyncServer("/api/device-users/disable", {
    customer_id: params.customerId,
    device_id: params.deviceSn,
  });
}

async function deleteCustomerFromGymSyncServer(params: { customerId: string; deviceSn: string }) {
  return callGymSyncServer("/api/device-users/delete", {
    customer_id: params.customerId,
    device_id: params.deviceSn,
  });
}

async function syncCustomerDeviceAccess(params: {
  adminClient: AdminSupabaseClient;
  customerId: string;
  deviceSn: string;
}): Promise<DeviceSyncResult> {
  await expirePastDueSubscriptionsForCustomer(params.adminClient, params.customerId);

  const profile = await getCustomerDeviceProfile(params.adminClient, params.customerId);
  if (!profile.ok) {
    return {
      attempted: true,
      action: "disable",
      synced: false,
      queued: false,
      method: "none",
      reason: profile.reason,
      error: profile.error,
    };
  }

  const hasActiveSubscription = await customerHasActiveSubscription(params.adminClient, params.customerId);
  const shouldEnable = profile.isActive && hasActiveSubscription;

  if (shouldEnable) {
    const syncResult = await syncCustomerWithGymSyncServer({
      customerId: params.customerId,
      deviceSn: params.deviceSn,
    });

    if (syncResult.synced === true) {
      return {
        ...syncResult,
        action: "enable",
      };
    }

    const queueResult = await queueZkUserSync({
      adminClient: params.adminClient,
      customerId: params.customerId,
      deviceSn: params.deviceSn,
    });

    return {
      attempted: true,
      action: "enable",
      synced: queueResult.queued,
      queued: queueResult.queued,
      method: queueResult.queued ? "queue" : syncResult.method ?? "none",
      reason: queueResult.queued ? undefined : normalizeOptionalString(queueResult.reason) ?? syncResult.reason,
      error: "error" in queueResult ? normalizeOptionalString(queueResult.error) ?? syncResult.error : syncResult.error,
    };
  }

  const syncResult = await disableCustomerOnGymSyncServer({
    customerId: params.customerId,
    deviceSn: params.deviceSn,
  });

  if (syncResult.synced === true) {
    return {
      ...syncResult,
      action: "disable",
    };
  }

  const queueResult = await queueZkCommands({
    adminClient: params.adminClient,
    customerId: params.customerId,
    deviceSn: params.deviceSn,
    buildCommands: (queuedProfile) => [buildZkUserDisableCommand({ biometricId: queuedProfile.biometricId })],
  });

  return {
    attempted: true,
    action: "disable",
    synced: queueResult.queued,
    queued: queueResult.queued,
    method: queueResult.queued ? "queue" : syncResult.method ?? "none",
    reason: queueResult.queued ? undefined : normalizeOptionalString(queueResult.reason) ?? syncResult.reason,
    error: "error" in queueResult ? normalizeOptionalString(queueResult.error) ?? syncResult.error : syncResult.error,
  };
}

export interface CreateCustomerData {
  origin?: "customers" | "cash";
  // Auth
  email?: string;
  password?: string;
  // Profile
  full_name: string;
  phone: string;
  birth_date?: Date;
  gender: "male" | "female" | "other";
  emergency_contact?: string;
  emergency_phone?: string;
  // Subscription
  plan_id?: number;
  final_price?: number;
  discount_amount?: number;
  payment_method?: "cash" | "card" | "transfer";
  start_date?: Date;
  end_date?: Date;
  // Body Assessment
  weight_kg?: number;
  height_cm?: number;
  diet_type?: DietType;
  activity_level?: ActivityLevel;
  body_fat_percentage?: number;
  muscle_mass_kg?: number;
  chest?: number;
  waist?: number;
  hip?: number;
  arm_right?: number;
  arm_left?: number;
  leg_right?: number;
  leg_left?: number;
  injuries?: string;
  body_type?: BodyType;
  primary_goal?: TrainingProfileInput["primary_goal"];
  secondary_goal?: TrainingProfileInput["secondary_goal"];
  focus_areas?: TrainingProfileInput["focus_areas"];
  experience_level?: TrainingProfileInput["experience_level"];
  days_per_week?: number;
  session_minutes?: number;
  training_location?: TrainingProfileInput["training_location"];
  equipment_available?: TrainingProfileInput["equipment_available"];
  cardio_preference?: TrainingProfileInput["cardio_preference"];
  exercise_preferences?: string;
  exercise_dislikes?: string;
  injuries_or_pain?: string;
  restricted_movements?: TrainingProfileInput["restricted_movements"];
  parq_requires_attention?: boolean;
  medical_clearance_notes?: string;
}

function buildTrainingProfileInput(data: Partial<CreateCustomerData>): TrainingProfileInput {
  return {
    primary_goal: data.primary_goal ?? null,
    secondary_goal: data.secondary_goal ?? null,
    focus_areas: data.focus_areas ?? [],
    experience_level: data.experience_level ?? null,
    days_per_week: data.days_per_week ?? null,
    session_minutes: data.session_minutes ?? null,
    training_location: data.training_location ?? DEFAULT_TRAINING_LOCATION,
    equipment_available: data.equipment_available?.length ? data.equipment_available : DEFAULT_EQUIPMENT_AVAILABLE,
    activity_level: data.activity_level ?? null,
    cardio_preference: data.cardio_preference ?? null,
    exercise_preferences: normalizeNullableText(data.exercise_preferences),
    exercise_dislikes: normalizeNullableText(data.exercise_dislikes),
    injuries_or_pain: normalizeNullableText(data.injuries_or_pain),
    restricted_movements: data.restricted_movements ?? [],
    parq_requires_attention: data.parq_requires_attention ?? null,
    medical_clearance_notes: normalizeNullableText(data.medical_clearance_notes),
  };
}

function buildPartialTrainingProfileUpdate(data: Partial<CreateCustomerData>): Partial<TrainingProfileInput> {
  const update: Partial<TrainingProfileInput> = {};

  if (data.primary_goal !== undefined) update.primary_goal = data.primary_goal;
  if (data.secondary_goal !== undefined) update.secondary_goal = data.secondary_goal;
  if (data.focus_areas !== undefined) update.focus_areas = data.focus_areas;
  if (data.experience_level !== undefined) update.experience_level = data.experience_level;
  if (data.days_per_week !== undefined) update.days_per_week = data.days_per_week;
  if (data.session_minutes !== undefined) update.session_minutes = data.session_minutes;
  if (data.training_location !== undefined) update.training_location = data.training_location ?? DEFAULT_TRAINING_LOCATION;
  if (data.equipment_available !== undefined) {
    update.equipment_available = data.equipment_available.length > 0 ? data.equipment_available : DEFAULT_EQUIPMENT_AVAILABLE;
  }
  if (data.activity_level !== undefined) update.activity_level = data.activity_level;
  if (data.cardio_preference !== undefined) update.cardio_preference = data.cardio_preference;
  if (data.exercise_preferences !== undefined) update.exercise_preferences = normalizeNullableText(data.exercise_preferences);
  if (data.exercise_dislikes !== undefined) update.exercise_dislikes = normalizeNullableText(data.exercise_dislikes);
  if (data.injuries_or_pain !== undefined) update.injuries_or_pain = normalizeNullableText(data.injuries_or_pain);
  if (data.restricted_movements !== undefined) update.restricted_movements = data.restricted_movements;
  if (data.parq_requires_attention !== undefined) update.parq_requires_attention = data.parq_requires_attention;
  if (data.medical_clearance_notes !== undefined) {
    update.medical_clearance_notes = normalizeNullableText(data.medical_clearance_notes);
  }

  return update;
}

function buildNutritionContextFromData(data: Partial<CreateCustomerData>): NutritionContext {
  return {
    birthDate: data.birth_date ?? null,
    gender: data.gender ?? null,
    weightKg: data.weight_kg ?? null,
    heightCm: data.height_cm ?? null,
    bodyType: data.body_type ?? null,
    dietType: data.diet_type ?? null,
    activityLevel: data.activity_level ?? null,
  };
}

function canCreateBodyAssessment(data: Partial<CreateCustomerData>) {
  return typeof data.weight_kg === "number" && typeof data.height_cm === "number";
}

function hasBodyAssessmentChanges(data: Partial<CreateCustomerData>) {
  return (
    data.weight_kg !== undefined ||
    data.height_cm !== undefined ||
    data.body_type !== undefined ||
    data.diet_type !== undefined ||
    data.activity_level !== undefined ||
    data.body_fat_percentage !== undefined ||
    data.muscle_mass_kg !== undefined ||
    data.chest !== undefined ||
    data.waist !== undefined ||
    data.hip !== undefined ||
    data.arm_right !== undefined ||
    data.arm_left !== undefined ||
    data.leg_right !== undefined ||
    data.leg_left !== undefined
  );
}

function canComputeNutritionPlan(data: Partial<CreateCustomerData>) {
  return Boolean(
    data.birth_date &&
      data.gender &&
      typeof data.weight_kg === "number" &&
      typeof data.height_cm === "number" &&
      data.body_type &&
      data.diet_type &&
      data.activity_level,
  );
}

async function createSubscriptionAndPaymentLegacy(params: {
  adminClient: AdminSupabaseClient;
  userId: string;
  planId?: number;
  startDate?: Date;
  endDate?: Date;
  finalPrice?: number;
  discountAmount?: number;
  paymentMethod?: "cash" | "card" | "transfer";
}) {
  const { adminClient, userId, planId } = params;
  if (!planId) {
    return { subscriptionId: null as string | null };
  }

  const { data: planData, error: planError } = await adminClient
    .from("plans")
    .select("id, price, duration_days")
    .eq("id", planId)
    .single();

  if (planError || !planData) {
    throw new Error("Plan no encontrado");
  }

  const subscriptionStartDate = params.startDate ? formatToLocalISO(params.startDate) : new Date().toISOString().split("T")[0];
  const subscriptionEndDate =
    params.endDate
      ? formatToLocalISO(params.endDate)
      : (() => {
          const dt = new Date(subscriptionStartDate!);
          dt.setDate(dt.getDate() + Number(planData.duration_days || 30));
          return dt.toISOString().split("T")[0];
        })();

  const { data: subscription, error: subscriptionError } = await adminClient
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan_id: planId,
      start_date: subscriptionStartDate,
      end_date: subscriptionEndDate,
      status: "active",
      discount_amount: params.discountAmount || 0,
    })
    .select("id")
    .single();

  if (subscriptionError || !subscription) {
    throw subscriptionError || new Error("No se pudo crear la suscripcion");
  }

  const amountOriginal = Number(planData.price);
  const discountAmount = Number(params.discountAmount || 0);
  const amountPaid = Number(params.finalPrice ?? amountOriginal - discountAmount);

  const { error: paymentError } = await adminClient.from("payments").insert({
    subscription_id: subscription.id,
    user_id: userId,
    amount_original: amountOriginal,
    discount_amount: discountAmount,
    amount_paid: amountPaid,
    method: params.paymentMethod || "cash",
    payment_date: new Date().toISOString(),
  });

  if (paymentError) {
    throw paymentError;
  }

  return { subscriptionId: subscription.id };
}

async function createSubscriptionAndPayment(params: {
  adminClient: AdminSupabaseClient;
  userId: string;
  planId?: number;
  startDate?: Date;
  endDate?: Date;
  finalPrice?: number;
  discountAmount?: number;
  paymentMethod?: "cash" | "card" | "transfer";
  requireSession?: boolean;
}) {
  const { userId, planId } = params;
  if (!planId) {
    return { subscriptionId: null as string | null };
  }

  try {
    const result = await runCreateSubscriptionPaymentForExistingCustomer({
      customerId: userId,
      planId,
      startDate: formatToLocalISO(params.startDate) ?? null,
      endDate: formatToLocalISO(params.endDate) ?? null,
      finalPrice: params.finalPrice,
      discountAmount: params.discountAmount,
      paymentMethod: params.paymentMethod,
      requireSession: params.requireSession,
    });

    return { subscriptionId: result?.subscription_id ?? null };
  } catch (error) {
    if (!isCashModuleNotReadyError(error)) {
      throw error;
    }

    return createSubscriptionAndPaymentLegacy(params);
  }
}

async function createBodyAssessmentAndMaybeSnapshot(params: {
  adminClient: AdminSupabaseClient;
  userId: string;
  sourceEvent: "signup" | "renewal";
  subscriptionId?: string | null;
  metrics: Partial<CreateCustomerData>;
}) {
  const { adminClient, userId, sourceEvent, subscriptionId, metrics } = params;
  if (!canCreateBodyAssessment(metrics)) {
    return { computed: null as ReturnType<typeof computeFitnessPlan> | null };
  }

  const computed = canComputeNutritionPlan(metrics)
    ? computeFitnessPlan({
        birthDate: metrics.birth_date!,
        gender: metrics.gender!,
        weightKg: metrics.weight_kg!,
        heightCm: metrics.height_cm!,
        bodyType: metrics.body_type!,
        dietType: metrics.diet_type!,
        activityLevel: metrics.activity_level!,
      })
    : null;

  const assessmentPayload = {
    user_id: userId,
    date: new Date().toISOString().split("T")[0],
    weight_kg: metrics.weight_kg!,
    height_cm: metrics.height_cm!,
    body_type: metrics.body_type ?? null,
    diet_type: metrics.diet_type ?? null,
    activity_level: metrics.activity_level ?? null,
    body_fat_percentage: metrics.body_fat_percentage ?? null,
    muscle_mass_kg: metrics.muscle_mass_kg ?? null,
    chest: metrics.chest ?? null,
    waist: metrics.waist ?? null,
    hip: metrics.hip ?? null,
    arm_right: metrics.arm_right ?? null,
    arm_left: metrics.arm_left ?? null,
    leg_right: metrics.leg_right ?? null,
    leg_left: metrics.leg_left ?? null,
    daily_calories: computed?.dailyCalories ?? null,
    protein_grams: computed?.proteinGrams ?? null,
    carbs_grams: computed?.carbsGrams ?? null,
    fat_grams: computed?.fatGrams ?? null,
    water_liters_goal: computed?.waterLitersGoal ?? null,
  };

  const { error: assessmentError } = await adminClient.from("body_assessments").insert(assessmentPayload);
  if (assessmentError) throw assessmentError;

  if (computed) {
    const { error: snapshotError } = await adminClient.from("training_nutrition_snapshots").insert({
      user_id: userId,
      source_event: sourceEvent,
      subscription_id: subscriptionId ?? null,
      gender: metrics.gender!,
      age_years: computed.ageYears,
      height_cm: metrics.height_cm!,
      weight_kg: metrics.weight_kg!,
      body_type: metrics.body_type!,
      diet_type: metrics.diet_type!,
      activity_level: metrics.activity_level!,
      body_fat_percentage: metrics.body_fat_percentage ?? null,
      muscle_mass_kg: metrics.muscle_mass_kg ?? null,
      chest_cm: metrics.chest ?? null,
      waist_cm: metrics.waist ?? null,
      arm_right_cm: metrics.arm_right ?? null,
      arm_left_cm: metrics.arm_left ?? null,
      hip_cm: metrics.hip ?? null,
      leg_right_cm: metrics.leg_right ?? null,
      leg_left_cm: metrics.leg_left ?? null,
      daily_calories: computed.dailyCalories,
      protein_grams: computed.proteinGrams,
      carbs_grams: computed.carbsGrams,
      fat_grams: computed.fatGrams,
      water_liters_goal: computed.waterLitersGoal,
      cardio_minutes: computed.cardioMinutes,
      routine_mode: computed.routineMode,
      algorithm_version: computed.algorithmVersion,
    });

    if (snapshotError) throw snapshotError;
  }

  return { computed };
}

export async function createCustomer(data: CreateCustomerData) {
  try {
    data = normalizeCustomerPayload(data);
    const origin = data.origin || "customers";

    const access = await getUserAccessContext();
    if (!access.isAuthenticated || !access.userId) {
      return { success: false, error: "No autenticado" };
    }
    const isCashOrigin = origin === "cash";
    const canCreateFromCustomers = hasPermission(access, "customers.create");
    const canCreateFromCash = hasPermission(access, "cash.operate");

    if ((!isCashOrigin && !canCreateFromCustomers) || (isCashOrigin && !canCreateFromCash)) {
      return {
        success: false,
        error: isCashOrigin
          ? "No autorizado para registrar clientes desde caja"
          : "No autorizado: Solo administradores",
      };
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return { success: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY para crear clientes." };
    }

    const adminClient = createClientAdmin(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let createdUserId: string | null = null;

    try {
      const authPhone = normalizeGuatemalaPhoneForAuth(data.phone);
      if (!data.email && !authPhone) {
        return { success: false, error: "El teléfono del cliente no es válido para crear acceso." };
      }

      const authPayload = data.email
        ? {
            email: data.email,
            password: data.password || "Gym2026!",
            email_confirm: true,
            user_metadata: {
              full_name: data.full_name,
              role: "client",
              phone: data.phone,
            },
          }
        : {
            phone: authPhone!,
            password: data.password || "Gym2026!",
            phone_confirm: true,
            user_metadata: {
              full_name: data.full_name,
              role: "client",
              phone: data.phone,
            },
          };

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser(authPayload);

      if (authError || !authData.user) {
        return { success: false, error: `Error creando usuario: ${authError?.message || "unknown"}` };
      }

      createdUserId = authData.user.id;

      const { error: profileError } = await adminClient.from("profiles").upsert({
        id: createdUserId,
        full_name: data.full_name,
        phone: data.phone,
        birth_date: formatToLocalISO(data.birth_date) ?? null,
        gender: data.gender,
        injuries: normalizeNullableText(data.injuries),
        medical_notes: normalizeNullableText(data.medical_clearance_notes),
        role: "client",
        is_active: true,
        training_profile_status: "pending",
      });

      if (profileError) {
        throw profileError;
      }

      const { subscriptionId } = await createSubscriptionAndPayment({
        adminClient,
        userId: createdUserId,
        planId: data.plan_id,
        startDate: data.start_date,
        endDate: data.end_date,
        finalPrice: data.final_price,
        discountAmount: data.discount_amount,
        paymentMethod: data.payment_method,
        requireSession: isCashOrigin,
      });

      await createBodyAssessmentAndMaybeSnapshot({
        adminClient,
        userId: createdUserId,
        sourceEvent: "signup",
        subscriptionId,
        metrics: data,
      });

      await syncTrainingProfileWithAdmin({
        adminClient,
        userId: createdUserId,
        createdBy: access.userId,
        trainingProfile: buildTrainingProfileInput(data),
        nutritionContext: buildNutritionContextFromData(data),
      });
    } catch (creationError) {
      if (createdUserId) {
        await adminClient.auth.admin.deleteUser(createdUserId).catch(() => null);
      }
      throw creationError;
    }

    let deviceSync: DeviceSyncResult = {
      attempted: false,
    };

    if (DEFAULT_ZK_DEVICE_SN) {
      try {
        if (createdUserId) {
          deviceSync = await syncCustomerDeviceAccess({
            adminClient,
            customerId: createdUserId,
            deviceSn: DEFAULT_ZK_DEVICE_SN,
          });
        } else {
          deviceSync = {
            attempted: true,
            action: "disable",
            synced: false,
            queued: false,
            method: "none",
            reason: "customer_id_not_resolved",
          };
        }
      } catch (deviceError) {
        console.error("Error en sincronización automática con ZKTeco:", deviceError);
        deviceSync = {
          attempted: true,
          action: "disable",
          synced: false,
          queued: false,
          method: "none",
          reason: "exception",
        };
      }
    }

    revalidatePath("/panel/clientes");
    revalidatePath("/panel/resumen");
    revalidatePath("/panel/caja");
    revalidatePath("/panel/caja/historial");
    return { success: true, data: { user_id: createdUserId }, deviceSync };
  } catch (error) {
    console.error("Error creating customer:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error de conexión" };
  }
}

export async function getPlans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, price, duration_days")
    .eq("is_active", true)
    .order("price");

  if (error) {
    console.error("Error fetching plans:", error);
    return [];
  }
  return data || [];
}

export async function getCustomerById(id: string) {
  const supabase = await createClient();

  // Intentar obtener desde la vista customer_overview que ya sabemos que funciona para la lista
  const { data: customerView, error: viewError } = await supabase
    .from("customer_overview")
    .select(
      "id, full_name, phone, avatar_url, role, subscription_status, subscription_start_date, subscription_end_date, plan_name, last_check_in, plan_id, birth_date, gender, is_active",
    )
    .eq("id", id)
    .single();

  console.log("Customer View Data:", customerView);

  if (viewError) {
    console.error("Error fetching customer view:", viewError);
    // Fallback a profiles si falla la vista
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).single();
    return profile;
  }

  // Obtener el email del usuario desde auth.users usando el admin client
  const userEmail = await getUserEmail(id);

  // Obtener los datos físicos más recientes
  const { data: bodyAssessment } = await supabase
    .from("body_assessments")
    .select("*")
    .eq("user_id", id)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle(); // Usar maybeSingle por si no hay registros

  const { data: latestSnapshot } = await supabase
    .from("training_nutrition_snapshots")
    .select("*")
    .eq("user_id", id)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: trainingProfile } = await supabase
    .from("training_profiles")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();

  // Si la vista no tiene plan_id pero tiene plan_name, necesitamos obtener el ID del plan
  let planId = customerView.plan_id;

  if (!planId && customerView.plan_name) {
    console.log(`Searching plan by name: "${customerView.plan_name}"`);
    const { data: plan } = await supabase.from("plans").select("id").ilike("name", customerView.plan_name).single();

    if (plan) {
      console.log(`Plan found via name lookup: ${plan.id}`);
      planId = plan.id;
    } else {
      console.log("Plan NOT found by name");
      // Intento con búsqueda parcial si falla la exacta
      const { data: planPartial } = await supabase
        .from("plans")
        .select("id")
        .ilike("name", `%${customerView.plan_name}%`)
        .limit(1)
        .single();

      if (planPartial) {
        console.log(`Plan found via partial lookup: ${planPartial.id}`);
        planId = planPartial.id;
      } else {
        // Último recurso: traer todos los planes y buscar en memoria
        console.log("Plan NOT found via partial lookup. Trying in-memory search...");
        const { data: allPlans } = await supabase.from("plans").select("id, name");
        if (allPlans) {
          const match = allPlans.find(
            (p) =>
              p.name.toLowerCase().includes(customerView.plan_name.toLowerCase()) ||
              customerView.plan_name.toLowerCase().includes(p.name.toLowerCase()),
          );
          if (match) {
            console.log(`Plan found via in-memory search: ${match.name} (${match.id})`);
            planId = match.id;
          } else {
            console.log("Plan NOT found in-memory.");
          }
        }
      }
    }
  }

  // Fetch subscription for editing: prioritize ACTIVE, fallback to most recent
  // First try to get active subscription
  let latestSubscription = null;

  const { data: activeSubscription } = await supabase
    .from("subscriptions")
    .select("*, plans(id, name)")
    .eq("user_id", id)
    .eq("status", "active")
    .order("end_date", { ascending: false, nullsFirst: false })
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (activeSubscription) {
    latestSubscription = activeSubscription;
  } else {
    // No active subscription, get most recent (expired)
    const { data: recentSubscription } = await supabase
      .from("subscriptions")
      .select("*, plans(id, name)")
      .eq("user_id", id)
      .order("end_date", { ascending: false, nullsFirst: false })
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    latestSubscription = recentSubscription;
  }

  // Fetch profile data
  const { data: profileData } = await supabase
    .from("profiles")
    .select("birth_date, injuries, gender, medical_notes")
    .eq("id", id)
    .maybeSingle();

  // Fetch Payment Method from latest subscription
  let paymentMethod = null;
  let finalPrice: number | null = null;

  if (latestSubscription) {
    const { data: lastPayment } = await runPaymentsPostedQueryCompat((usePostedFilter) => {
      let query = supabase
        .from("payments")
        .select("method, amount_paid")
        .eq("subscription_id", latestSubscription.id)
        .order("payment_date", { ascending: false })
        .limit(1);

      if (usePostedFilter) {
        query = query.eq("status", "posted");
      }

      return query.maybeSingle();
    });

    if (lastPayment) {
      paymentMethod = lastPayment.method;
      finalPrice = typeof lastPayment.amount_paid === "number" ? lastPayment.amount_paid : Number(lastPayment.amount_paid ?? 0);
    }
  }

  // Determine Plan ID from latest subscription (authoritative) or fallback to View
  // IMPORTANTE: Si updatedCustomerView tiene un plan_id pero latestSubscription no (null),
  // puede que sea un plan \"legacy\" o inconsistencia. Priorizamos latestSubscription si existe.
  let finalPlanId = latestSubscription?.plan_id;
  if (!finalPlanId && customerView.plan_id) finalPlanId = customerView.plan_id;
  if (!finalPlanId && planId) finalPlanId = planId; // Fallback from expensive search logic if needed

  // Mapear los datos de la vista a lo que espera el formulario
  return {
    ...customerView, // Tiene full_name, phone, etc. (pero NO email)
    email: userEmail, // Email obtenido desde auth.users
    birth_date: profileData?.birth_date || customerView.birth_date || null,
    gender: profileData?.gender || customerView.gender || null,
    injuries: profileData?.injuries ?? null,

    // Datos de suscripción REFRESCADOS desde la tabla real
    plan_id: finalPlanId || null,
    payment_method: paymentMethod || "cash",
    final_price: finalPrice,

    // Usar fechas de la suscripción más reciente si existe, sino fallback a vista
    subscription_start_date: latestSubscription?.start_date || customerView.subscription_start_date || null,
    subscription_end_date: latestSubscription?.end_date || customerView.subscription_end_date || null,

    // Descuento aplicado (de la suscripción más reciente)
    discount_amount: latestSubscription?.discount_amount ?? 0,

    // Datos físicos
    weight_kg: bodyAssessment?.weight_kg ?? latestSnapshot?.weight_kg ?? null,
    height_cm: bodyAssessment?.height_cm ?? latestSnapshot?.height_cm ?? null,
    body_type: bodyAssessment?.body_type ?? latestSnapshot?.body_type ?? null,
    activity_level: trainingProfile?.activity_level ?? bodyAssessment?.activity_level ?? latestSnapshot?.activity_level ?? null,
    diet_type: bodyAssessment?.diet_type ?? latestSnapshot?.diet_type ?? null,
    body_fat_percentage: bodyAssessment?.body_fat_percentage ?? latestSnapshot?.body_fat_percentage ?? null,
    muscle_mass_kg: bodyAssessment?.muscle_mass_kg ?? latestSnapshot?.muscle_mass_kg ?? null,
    chest: bodyAssessment?.chest ?? latestSnapshot?.chest_cm ?? null,
    waist: bodyAssessment?.waist ?? latestSnapshot?.waist_cm ?? null,
    hip: bodyAssessment?.hip ?? latestSnapshot?.hip_cm ?? null,
    arm_right: bodyAssessment?.arm_right ?? latestSnapshot?.arm_right_cm ?? null,
    arm_left: bodyAssessment?.arm_left ?? latestSnapshot?.arm_left_cm ?? null,
    leg_right: bodyAssessment?.leg_right ?? latestSnapshot?.leg_right_cm ?? null,
    leg_left: bodyAssessment?.leg_left ?? latestSnapshot?.leg_left_cm ?? null,
    body_assessment_id: bodyAssessment?.id || null,
    primary_goal: trainingProfile?.primary_goal || null,
    secondary_goal: trainingProfile?.secondary_goal || null,
    focus_areas: trainingProfile?.focus_areas || [],
    experience_level: trainingProfile?.experience_level || null,
    days_per_week: trainingProfile?.days_per_week || null,
    session_minutes: trainingProfile?.session_minutes || null,
    training_location: trainingProfile?.training_location || DEFAULT_TRAINING_LOCATION,
    equipment_available: trainingProfile?.equipment_available || DEFAULT_EQUIPMENT_AVAILABLE,
    cardio_preference: trainingProfile?.cardio_preference || null,
    exercise_preferences: trainingProfile?.exercise_preferences ?? null,
    exercise_dislikes: trainingProfile?.exercise_dislikes ?? null,
    injuries_or_pain: trainingProfile?.injuries_or_pain ?? null,
    restricted_movements: trainingProfile?.restricted_movements || [],
    parq_requires_attention:
      typeof trainingProfile?.parq_requires_attention === "boolean" ? trainingProfile.parq_requires_attention : null,
    medical_clearance_notes: trainingProfile?.medical_clearance_notes ?? profileData?.medical_notes ?? null,
    training_profile_status: trainingProfile?.is_complete ? "complete" : "pending",
  };
}

// Helper para formatear Date a YYYY-MM-DD usando tiempo local (evita cambios por UTC)
function formatToLocalISO(date: Date | undefined | null): string | undefined | null {
  if (date === null) return null;
  if (date === undefined) return undefined;

  const d = new Date(date);
  if (isNaN(d.getTime())) return undefined;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface AssessmentMetrics {
  weight_kg: number;
  height_cm: number;
  body_type: BodyType;
  diet_type: DietType;
  activity_level: ActivityLevel;
  body_fat_percentage?: number;
  muscle_mass_kg?: number;
  chest?: number;
  waist?: number;
  hip?: number;
  arm_right?: number;
  arm_left?: number;
  leg_right?: number;
  leg_left?: number;
}

async function createAssessmentAndSnapshot(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  birthDate: Date;
  gender: "male" | "female" | "other";
  sourceEvent: "signup" | "renewal";
  subscriptionId?: string | null;
  metrics: AssessmentMetrics;
}) {
  const { supabase, userId, birthDate, gender, sourceEvent, subscriptionId, metrics } = params;
  const computed = computeFitnessPlan({
    birthDate,
    gender,
    weightKg: metrics.weight_kg,
    heightCm: metrics.height_cm,
    bodyType: metrics.body_type,
    dietType: metrics.diet_type,
    activityLevel: metrics.activity_level,
  });

  const assessmentPayload = {
    user_id: userId,
    date: new Date().toISOString().split("T")[0],
    weight_kg: metrics.weight_kg,
    height_cm: metrics.height_cm,
    body_type: metrics.body_type,
    diet_type: metrics.diet_type,
    activity_level: metrics.activity_level,
    body_fat_percentage: metrics.body_fat_percentage ?? null,
    muscle_mass_kg: metrics.muscle_mass_kg ?? null,
    chest: metrics.chest ?? null,
    waist: metrics.waist ?? null,
    hip: metrics.hip ?? null,
    arm_right: metrics.arm_right ?? null,
    arm_left: metrics.arm_left ?? null,
    leg_right: metrics.leg_right ?? null,
    leg_left: metrics.leg_left ?? null,
    water_liters_goal: computed.waterLitersGoal,
    daily_calories: computed.dailyCalories,
    protein_grams: computed.proteinGrams,
    carbs_grams: computed.carbsGrams,
    fat_grams: computed.fatGrams,
  };

  const { error: assessmentError } = await supabase.from("body_assessments").insert(assessmentPayload);
  if (assessmentError) throw assessmentError;

  const snapshotPayload = {
    user_id: userId,
    source_event: sourceEvent,
    subscription_id: subscriptionId ?? null,
    gender,
    age_years: computed.ageYears,
    height_cm: metrics.height_cm,
    weight_kg: metrics.weight_kg,
    body_type: metrics.body_type,
    diet_type: metrics.diet_type,
    activity_level: metrics.activity_level,
    body_fat_percentage: metrics.body_fat_percentage ?? null,
    muscle_mass_kg: metrics.muscle_mass_kg ?? null,
    chest_cm: metrics.chest ?? null,
    waist_cm: metrics.waist ?? null,
    arm_right_cm: metrics.arm_right ?? null,
    arm_left_cm: metrics.arm_left ?? null,
    hip_cm: metrics.hip ?? null,
    leg_right_cm: metrics.leg_right ?? null,
    leg_left_cm: metrics.leg_left ?? null,
    daily_calories: computed.dailyCalories,
    protein_grams: computed.proteinGrams,
    carbs_grams: computed.carbsGrams,
    fat_grams: computed.fatGrams,
    water_liters_goal: computed.waterLitersGoal,
    cardio_minutes: computed.cardioMinutes,
    routine_mode: computed.routineMode,
    algorithm_version: computed.algorithmVersion,
  };

  const { error: snapshotError } = await supabase.from("training_nutrition_snapshots").insert(snapshotPayload);
  if (snapshotError) throw snapshotError;

  return computed;
}

export async function updateCustomer(id: string, data: Partial<CreateCustomerData>) {
  const supabase = await createClient();
  data = normalizeCustomerPayload(data);

  console.log(`Updating customer ${id}`, data);

  try {
    const currentAccess = await getUserAccessContext();
    if (!currentAccess.isAuthenticated || !currentAccess.isAdmin || !currentAccess.userId) {
      return { success: false, error: "No autorizado" };
    }

    const [{ data: currentProfile }, { data: existingTrainingProfile }, { data: latestAssessmentRow }] = await Promise.all([
      supabase.from("profiles").select("birth_date, gender, injuries, medical_notes, phone").eq("id", id).maybeSingle(),
      supabase.from("training_profiles").select("*").eq("user_id", id).maybeSingle(),
      supabase
        .from("body_assessments")
        .select("*")
        .eq("user_id", id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const phoneChanged = data.phone !== undefined && data.phone !== (currentProfile?.phone ?? undefined);
    const needsAuthUpdate = Boolean(data.password && data.password.length >= 6) || data.email !== undefined || phoneChanged;

    let adminClient: AdminSupabaseClient | null = null;
    let authUser: { email?: string | null; phone?: string | null } | null = null;

    if (needsAuthUpdate) {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        console.error("Missing service role key for auth update");
        return { success: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY para actualizar credenciales." };
      }

      adminClient = createClientAdmin(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const {
        data: { user: authUserRecord },
        error: authUserError,
      } = await adminClient.auth.admin.getUserById(id);

      if (authUserError || !authUserRecord) {
        console.error("Error loading auth user:", authUserError);
        return { success: false, error: "No se pudo cargar el acceso del cliente." };
      }

      authUser = authUserRecord;
    }

    const ensureAdminClient = () => {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para actualizar la membresía del cliente.");
      }

      if (!adminClient) {
        adminClient = createClientAdmin(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
      }

      return adminClient;
    };

    // 0. Actualizar contraseña si se proporciona
    if (data.password && data.password.length >= 6 && adminClient) {
      console.log(`Updating password for user ${id}`);

      try {
        const { error: passwordError } = await adminClient.auth.admin.updateUserById(id, {
          password: data.password,
        });

        if (passwordError) {
          console.error("Error updating password:", passwordError);
          return {
            success: false,
            error: `Error al cambiar contraseña: ${passwordError.message || "Error desconocido"}`,
          };
        }

        console.log("Password updated successfully");
      } catch (passwordUpdateError) {
        console.error("Unexpected error updating password:", passwordUpdateError);
        return { success: false, error: "Error inesperado al actualizar contraseña" };
      }
    }

    if (adminClient && authUser) {
      const authUpdatePayload: Record<string, unknown> = {};
      const normalizedEmail = normalizeOptionalEmail(data.email);
      const currentEmail = normalizeAuthEmail(authUser.email);

      if (normalizedEmail && normalizedEmail !== currentEmail) {
        authUpdatePayload.email = normalizedEmail;
        authUpdatePayload.email_confirm = true;
      }

      if (data.phone !== undefined) {
        const normalizedPhone = normalizeGuatemalaPhoneForAuth(data.phone);
        const currentPhone = normalizeGuatemalaPhoneForAuth(authUser.phone);
        const phoneOnlyAccount = !currentEmail && Boolean(currentPhone);

        if (normalizedPhone && (phoneOnlyAccount || currentPhone)) {
          if (normalizedPhone !== currentPhone) {
            authUpdatePayload.phone = normalizedPhone;
            authUpdatePayload.phone_confirm = true;
          }
        }
      }

      if (Object.keys(authUpdatePayload).length > 0) {
        const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(id, authUpdatePayload);

        if (authUpdateError) {
          console.error("Error updating auth identifiers:", authUpdateError);
          return {
            success: false,
            error: `Error al actualizar acceso: ${authUpdateError.message || "Error desconocido"}`,
          };
        }
      }
    }

    // 1. Actualizar el perfil
    const profileUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.full_name !== undefined) profileUpdate.full_name = data.full_name;
    if (data.phone !== undefined) profileUpdate.phone = data.phone;
    if (data.birth_date !== undefined) profileUpdate.birth_date = formatToLocalISO(data.birth_date);
    if (data.gender !== undefined) profileUpdate.gender = data.gender;
    if (data.injuries !== undefined) {
      profileUpdate.injuries = normalizeNullableText(data.injuries);
    }
    if (data.medical_clearance_notes !== undefined) {
      profileUpdate.medical_notes = normalizeNullableText(data.medical_clearance_notes);
    }

    const { error: profileError } = await supabase.from("profiles").update(profileUpdate).eq("id", id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      return { success: false, error: `Error perfil: ${profileError.message}` };
    }

    if (hasMembershipPayload(data)) {
      await upsertMembershipForCustomer({
        adminClient: ensureAdminClient(),
        actorUserId: currentAccess.userId,
        customerId: id,
        data,
      });
    }

    // 2. Body Assessment
    if (hasBodyAssessmentChanges(data)) {
      const mergedMetrics = {
        weight_kg: data.weight_kg ?? latestAssessmentRow?.weight_kg ?? undefined,
        height_cm: data.height_cm ?? latestAssessmentRow?.height_cm ?? undefined,
        body_type: data.body_type ?? latestAssessmentRow?.body_type ?? undefined,
        diet_type: data.diet_type ?? latestAssessmentRow?.diet_type ?? undefined,
        activity_level: data.activity_level ?? latestAssessmentRow?.activity_level ?? undefined,
        body_fat_percentage: data.body_fat_percentage ?? latestAssessmentRow?.body_fat_percentage ?? undefined,
        muscle_mass_kg: data.muscle_mass_kg ?? latestAssessmentRow?.muscle_mass_kg ?? undefined,
        chest: data.chest ?? latestAssessmentRow?.chest ?? undefined,
        waist: data.waist ?? latestAssessmentRow?.waist ?? undefined,
        hip: data.hip ?? latestAssessmentRow?.hip ?? undefined,
        arm_right: data.arm_right ?? latestAssessmentRow?.arm_right ?? undefined,
        arm_left: data.arm_left ?? latestAssessmentRow?.arm_left ?? undefined,
        leg_right: data.leg_right ?? latestAssessmentRow?.leg_right ?? undefined,
        leg_left: data.leg_left ?? latestAssessmentRow?.leg_left ?? undefined,
      };

      if (canCreateBodyAssessment(mergedMetrics)) {
        const computed = canComputeNutritionPlan({
          birth_date: data.birth_date ?? (currentProfile?.birth_date ? new Date(currentProfile.birth_date) : undefined),
          gender: data.gender ?? currentProfile?.gender ?? undefined,
          weight_kg: mergedMetrics.weight_kg,
          height_cm: mergedMetrics.height_cm,
          body_type: mergedMetrics.body_type,
          diet_type: mergedMetrics.diet_type,
          activity_level: mergedMetrics.activity_level,
        })
          ? computeFitnessPlan({
              birthDate: data.birth_date ?? new Date(currentProfile!.birth_date),
              gender: (data.gender ?? currentProfile!.gender) as "male" | "female" | "other",
              weightKg: mergedMetrics.weight_kg!,
              heightCm: mergedMetrics.height_cm!,
              bodyType: mergedMetrics.body_type!,
              dietType: mergedMetrics.diet_type!,
              activityLevel: mergedMetrics.activity_level!,
            })
          : null;

        const assessmentData: Record<string, unknown> = {
          user_id: id,
          weight_kg: mergedMetrics.weight_kg,
          height_cm: mergedMetrics.height_cm,
          body_type: mergedMetrics.body_type ?? null,
          diet_type: mergedMetrics.diet_type ?? null,
          activity_level: mergedMetrics.activity_level ?? null,
          body_fat_percentage: mergedMetrics.body_fat_percentage ?? null,
          muscle_mass_kg: mergedMetrics.muscle_mass_kg ?? null,
          chest: mergedMetrics.chest ?? null,
          waist: mergedMetrics.waist ?? null,
          hip: mergedMetrics.hip ?? null,
          arm_right: mergedMetrics.arm_right ?? null,
          arm_left: mergedMetrics.arm_left ?? null,
          leg_right: mergedMetrics.leg_right ?? null,
          leg_left: mergedMetrics.leg_left ?? null,
          daily_calories: computed?.dailyCalories ?? null,
          protein_grams: computed?.proteinGrams ?? null,
          carbs_grams: computed?.carbsGrams ?? null,
          fat_grams: computed?.fatGrams ?? null,
          water_liters_goal: computed?.waterLitersGoal ?? null,
        };

        if (latestAssessmentRow?.id) {
          const { error: assessError } = await supabase.from("body_assessments").update(assessmentData).eq("id", latestAssessmentRow.id);
          if (assessError) console.error("Error updating assessment:", assessError);
        } else {
          const { error: assessError } = await supabase
            .from("body_assessments")
            .insert({ ...assessmentData, date: new Date().toISOString().split("T")[0] });
          if (assessError) console.error("Error creating assessment:", assessError);
        }
      }
    }

    const trainingProfileUpdate = buildPartialTrainingProfileUpdate(data);
    const shouldSyncTrainingProfile =
      Object.keys(trainingProfileUpdate).length > 0 ||
      data.weight_kg !== undefined ||
      data.height_cm !== undefined ||
      data.birth_date !== undefined ||
      data.gender !== undefined;

    if (shouldSyncTrainingProfile || existingTrainingProfile) {
      const mergedTrainingProfile = {
        ...(existingTrainingProfile || {}),
        ...trainingProfileUpdate,
      } as TrainingProfileInput;

      await syncTrainingProfileWithAdmin({
        adminClient: ensureAdminClient(),
        userId: id,
        createdBy: currentAccess.userId,
        trainingProfile: mergedTrainingProfile,
        nutritionContext: {
          birthDate: data.birth_date ?? (currentProfile?.birth_date ? new Date(currentProfile.birth_date) : null),
          gender: (data.gender ?? currentProfile?.gender ?? null) as "male" | "female" | "other" | null,
          weightKg: data.weight_kg ?? latestAssessmentRow?.weight_kg ?? null,
          heightCm: data.height_cm ?? latestAssessmentRow?.height_cm ?? null,
          bodyType: data.body_type ?? latestAssessmentRow?.body_type ?? null,
          dietType: data.diet_type ?? latestAssessmentRow?.diet_type ?? null,
          activityLevel: data.activity_level ?? latestAssessmentRow?.activity_level ?? null,
        },
      });
    }

    const shouldSyncDeviceState =
      Boolean(DEFAULT_ZK_DEVICE_SN && SUPABASE_SERVICE_ROLE_KEY) &&
      (data.full_name !== undefined || data.plan_id !== undefined || data.start_date !== undefined || data.end_date !== undefined);

    let deviceSync: DeviceSyncResult | undefined;

    if (shouldSyncDeviceState) {
      deviceSync = await syncCustomerDeviceAccess({
        adminClient: ensureAdminClient(),
        customerId: id,
        deviceSn: DEFAULT_ZK_DEVICE_SN,
      });
    }

    console.log("Update sequence completed successfully for", id);
    revalidatePath("/panel/clientes");
    revalidatePath(`/panel/clientes/${id}`);
    revalidatePath(`/panel/clientes/${id}/history`);
    revalidatePath("/panel/resumen");
    revalidatePath("/panel/pagos");
    revalidatePath("/panel/caja");
    revalidatePath("/panel/caja/historial");

    return { success: true, deviceSync };
  } catch (error) {
    console.error("CRITICAL: Exception in updateCustomer action:", error);
    return { success: false, error: "Excepción al actualizar. Revisa los logs." };
  }
}

export interface RenewSubscriptionData {
  origin?: "customers" | "cash";
  plan_id: number;
  start_date: Date;
  end_date: Date;
  price: number;
  discount_amount: number;
  amount_paid: number;
  payment_method: "cash" | "card" | "transfer";
  // Physical Assessment
  weight_kg: number;
  height_cm: number;
  body_type: BodyType;
  diet_type: DietType;
  activity_level: ActivityLevel;
  body_fat_percentage?: number;
  muscle_mass_kg?: number;
  chest?: number;
  waist?: number;
  hip?: number;
  arm_right?: number;
  arm_left?: number;
  leg_right?: number;
  leg_left?: number;
  injuries?: string;
  primary_goal?: TrainingProfileInput["primary_goal"];
  secondary_goal?: TrainingProfileInput["secondary_goal"];
  focus_areas?: TrainingProfileInput["focus_areas"];
  experience_level?: TrainingProfileInput["experience_level"];
  days_per_week?: number;
  session_minutes?: number;
  training_location?: TrainingProfileInput["training_location"];
  equipment_available?: TrainingProfileInput["equipment_available"];
  cardio_preference?: TrainingProfileInput["cardio_preference"];
  exercise_preferences?: string;
  exercise_dislikes?: string;
  injuries_or_pain?: string;
  restricted_movements?: TrainingProfileInput["restricted_movements"];
  parq_requires_attention?: boolean;
  medical_clearance_notes?: string;
}

async function renewSubscriptionWithPaymentLegacy(params: {
  financialClient: Awaited<ReturnType<typeof createClient>> | AdminSupabaseClient;
  customerId: string;
  data: RenewSubscriptionData;
}) {
  const { financialClient, customerId, data } = params;

  const { error: archiveError } = await financialClient
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("user_id", customerId)
    .eq("status", "active");

  if (archiveError) {
    throw archiveError;
  }

  const { data: newSubscription, error: subscriptionError } = await financialClient
    .from("subscriptions")
    .insert({
      user_id: customerId,
      plan_id: data.plan_id,
      start_date: formatToLocalISO(data.start_date),
      end_date: formatToLocalISO(data.end_date),
      status: "active",
      discount_amount: data.discount_amount,
    })
    .select("id")
    .single();

  if (subscriptionError || !newSubscription) {
    throw subscriptionError || new Error("No se pudo crear la suscripcion renovada");
  }

  const { error: paymentError } = await financialClient.from("payments").insert({
    subscription_id: newSubscription.id,
    user_id: customerId,
    amount_original: data.price,
    discount_amount: data.discount_amount,
    amount_paid: data.amount_paid,
    method: data.payment_method,
    payment_date: new Date().toISOString(),
  });

  if (paymentError) {
    throw paymentError;
  }

  return { subscriptionId: newSubscription.id };
}

export async function renewSubscription(customerId: string, data: RenewSubscriptionData) {
  const supabase = await createClient();
  console.log(`Renewing subscription for customer ${customerId}`, data);
  const origin = data.origin || "customers";

  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!access.userId || !hasPermission(access, "customers.manage_membership")) {
      return { success: false, error: "No autorizado para renovar suscripciones" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("birth_date, gender")
      .eq("id", customerId)
      .single();

    if (profileError || !profile?.birth_date || !profile?.gender) {
      return { success: false, error: "No se pudo obtener perfil (nacimiento/género)." };
    }

    let newSubscriptionId: string | null = null;

    try {
      const financialResult = await runRenewSubscriptionWithPayment({
        customerId,
        planId: data.plan_id,
        startDate: formatToLocalISO(data.start_date) || "",
        endDate: formatToLocalISO(data.end_date) || "",
        price: data.price,
        discountAmount: data.discount_amount,
        amountPaid: data.amount_paid,
        paymentMethod: data.payment_method,
        requireSession: origin === "cash",
      });

      newSubscriptionId = financialResult?.subscription_id ?? null;
    } catch (error) {
      if (!isCashModuleNotReadyError(error)) {
        throw error;
      }

      const financialClient = SUPABASE_SERVICE_ROLE_KEY
        ? createClientAdmin(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : supabase;

      const legacyResult = await renewSubscriptionWithPaymentLegacy({
        financialClient,
        customerId,
        data,
      });

      newSubscriptionId = legacyResult.subscriptionId;
    }

    if (!newSubscriptionId) {
      return { success: false, error: "No se pudo crear la suscripción renovada" };
    }

    const profileUpdate: Record<string, unknown> = {};
    if (data.injuries !== undefined) {
      profileUpdate.injuries = normalizeNullableText(data.injuries);
    }
    if (data.medical_clearance_notes !== undefined) {
      profileUpdate.medical_notes = normalizeNullableText(data.medical_clearance_notes);
    }

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileUpdateError } = await supabase.from("profiles").update(profileUpdate).eq("id", customerId);
      if (profileUpdateError) {
        console.error("Renewal profile update warning:", profileUpdateError);
      }
    }

    await createAssessmentAndSnapshot({
      supabase,
      userId: customerId,
      birthDate: new Date(profile.birth_date),
      gender: profile.gender as "male" | "female" | "other",
      sourceEvent: "renewal",
      subscriptionId: newSubscriptionId,
      metrics: {
        weight_kg: data.weight_kg,
        height_cm: data.height_cm,
        body_type: data.body_type,
        diet_type: data.diet_type,
        activity_level: data.activity_level,
        body_fat_percentage: data.body_fat_percentage,
        muscle_mass_kg: data.muscle_mass_kg,
        chest: data.chest,
        waist: data.waist,
        hip: data.hip,
        arm_right: data.arm_right,
        arm_left: data.arm_left,
        leg_right: data.leg_right,
        leg_left: data.leg_left,
      },
    });

    try {
      const { data: existingTrainingProfile } = await supabase
        .from("training_profiles")
        .select("*")
        .eq("user_id", customerId)
        .maybeSingle();

      const trainingProfileUpdate = buildPartialTrainingProfileUpdate(data);

      if (existingTrainingProfile || Object.keys(trainingProfileUpdate).length > 0) {
        await syncTrainingProfileWithAdmin({
          adminClient: createClientAdmin(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
          }),
          userId: customerId,
          createdBy: access.userId,
          trainingProfile: {
            ...(existingTrainingProfile || {}),
            ...trainingProfileUpdate,
          } as TrainingProfileInput,
          nutritionContext: {
            birthDate: new Date(profile.birth_date),
            gender: profile.gender as "male" | "female" | "other",
            weightKg: data.weight_kg,
            heightCm: data.height_cm,
            bodyType: data.body_type,
            dietType: data.diet_type,
            activityLevel: data.activity_level,
          },
        });
      }
    } catch (routineError) {
      console.error("Routine generation warning:", routineError);
    }

    revalidatePath("/panel/clientes");
    revalidatePath(`/panel/clientes/${customerId}`);
    revalidatePath("/panel/resumen");
    revalidatePath("/panel/caja");
    revalidatePath("/panel/caja/historial");

    let deviceSync: DeviceSyncResult | undefined;

    if (DEFAULT_ZK_DEVICE_SN && SUPABASE_SERVICE_ROLE_KEY) {
      const adminClient = createClientAdmin(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      deviceSync = await syncCustomerDeviceAccess({
        adminClient,
        customerId,
        deviceSn: DEFAULT_ZK_DEVICE_SN,
      });
    }

    return { success: true, deviceSync };
  } catch (error) {
    console.error("Exception in renewSubscription:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado al renovar" };
  }
}

async function deleteRowsIfPossible(
  adminClient: AdminSupabaseClient,
  table: string,
  column: string,
  value: string | number,
) {
  const { error } = await adminClient.from(table).delete().eq(column, value);
  if (!error) return;

  const message = String(error.message || "");
  if (message.includes("does not exist") || message.includes("Could not find the table")) {
    return;
  }

  throw error;
}

export async function deleteCustomer(id: string) {
  const adminClient = createClientAdmin(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { error } = await adminClient.from("profiles").update({ is_active: false }).eq("id", id);

    if (error) {
      console.error("Error soft deleting customer (admin):", error);
      return { success: false, error: "Error al desactivar cliente" };
    }

    let deviceSync: DeviceSyncResult | undefined;

    if (DEFAULT_ZK_DEVICE_SN) {
      deviceSync = await syncCustomerDeviceAccess({
        adminClient,
        customerId: id,
        deviceSn: DEFAULT_ZK_DEVICE_SN,
      });
    }

    revalidatePath("/panel/clientes");
    revalidatePath(`/panel/clientes/${id}`);
    revalidatePath("/panel/resumen");
    return { success: true, deviceSync };
  } catch (error) {
    console.error("Exception in deleteCustomer:", error);
    return { success: false, error: "Error inesperado al desactivar" };
  }
}

export async function reactivateCustomer(id: string) {
  const adminClient = createClientAdmin(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { error } = await adminClient.from("profiles").update({ is_active: true }).eq("id", id);

    if (error) {
      console.error("Error reactivating customer (admin):", error);
      return { success: false, error: "Error al reactivar cliente" };
    }

    let deviceSync: DeviceSyncResult | undefined;

    if (DEFAULT_ZK_DEVICE_SN) {
      deviceSync = await syncCustomerDeviceAccess({
        adminClient,
        customerId: id,
        deviceSn: DEFAULT_ZK_DEVICE_SN,
      });
    }

    revalidatePath("/panel/clientes");
    revalidatePath(`/panel/clientes/${id}`);
    revalidatePath("/panel/resumen");
    return { success: true, deviceSync };
  } catch (error) {
    console.error("Exception in reactivateCustomer:", error);
    return { success: false, error: "Error inesperado al reactivar" };
  }
}

export async function permanentlyDeleteCustomer(id: string) {
  const adminClient = createClientAdmin(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    let deviceSync: DeviceSyncResult | undefined;

    if (DEFAULT_ZK_DEVICE_SN) {
      deviceSync = {
        ...(await deleteCustomerFromGymSyncServer({
          customerId: id,
          deviceSn: DEFAULT_ZK_DEVICE_SN,
        })),
        action: "delete",
      };

      if (deviceSync?.synced !== true && SUPABASE_SERVICE_ROLE_KEY) {
        const queueResult = await queueZkCommands({
          adminClient,
          customerId: id,
          deviceSn: DEFAULT_ZK_DEVICE_SN,
          buildCommands: (profile) => buildZkUserDeleteCommands({ biometricId: profile.biometricId }),
        });

        deviceSync = {
          attempted: true,
          action: "delete",
          synced: queueResult.queued,
          queued: queueResult.queued,
          method: queueResult.queued ? "queue" : "none",
          reason: queueResult.queued ? undefined : queueResult.reason,
          error: queueResult.queued ? undefined : queueResult.error,
        };
      }
    }

    if (deviceSync?.attempted && deviceSync.synced === false) {
      return {
        success: false,
        error: deviceSync.error || "No se pudo sincronizar la eliminación en el reloj",
      };
    }

    const profile = await getCustomerDeviceProfile(adminClient, id);
    const biometricId = profile.ok ? profile.biometricId : null;

    await deleteRowsIfPossible(adminClient, "payments", "user_id", id);
    await deleteRowsIfPossible(adminClient, "subscriptions", "user_id", id);
    await deleteRowsIfPossible(adminClient, "routines", "user_id", id);
    await deleteRowsIfPossible(adminClient, "body_assessments", "user_id", id);
    await deleteRowsIfPossible(adminClient, "training_nutrition_snapshots", "user_id", id);

    if (biometricId != null) {
      await deleteRowsIfPossible(adminClient, "attendance_logs", "biometric_id", biometricId);
    }

    const { error: profileDeleteError } = await adminClient.from("profiles").delete().eq("id", id);
    if (profileDeleteError) {
      console.error("Error deleting profile:", profileDeleteError);
      return { success: false, error: "Error al eliminar el perfil del cliente" };
    }

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(id);
    if (authDeleteError && !String(authDeleteError.message || "").toLowerCase().includes("user not found")) {
      console.error("Error deleting auth user:", authDeleteError);
      return { success: false, error: "Se eliminó el perfil, pero falló la eliminación del usuario autenticado" };
    }

    revalidatePath("/panel/clientes");
    revalidatePath("/panel/resumen");
    return { success: true, deviceSync };
  } catch (error) {
    console.error("Exception in permanentlyDeleteCustomer:", error);
    return { success: false, error: "Error inesperado al eliminar completamente" };
  }
}
