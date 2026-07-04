/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createOrUpdateMembershipFromServer } from "@/features/customers/lib/local-memberships";
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
import { DEFAULT_SUBSCRIPTION_GRACE_DAYS, getSubscriptionAccessUntilISO, normalizeGraceDays } from "@/lib/subscriptions/grace-period";
import { normalizeOptionalCustomerEmail } from "@/features/customers/lib/local-customers";

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

function resolveSubscriptionStatus(endDate: string, graceDays = DEFAULT_SUBSCRIPTION_GRACE_DAYS) {
  const accessUntil = getSubscriptionAccessUntilISO(endDate, graceDays) ?? endDate;
  return accessUntil < todayDateString() ? "expired" : "active";
}

function hasMembershipPayload(data: Partial<CreateCustomerData>) {
  return (
    data.plan_id !== undefined ||
    data.start_date !== undefined ||
    data.end_date !== undefined ||
    data.discount_amount !== undefined ||
    data.grace_days !== undefined ||
    data.payment_method !== undefined ||
    data.final_price !== undefined
  );
}

interface MembershipSnapshot {
  subscription: {
    id: string;
    plan_id: string | number | null;
    start_date: string | null;
    end_date: string | null;
    discount_amount: number | null;
    grace_days: number | null;
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
  const { getCustomerMembership } = await import("@/features/customers/lib/local-memberships");
  const localMembership = await getCustomerMembership(customerId);

  if (!localMembership) {
    return { subscription: null, payment: null };
  }

  const subscription = {
    id: localMembership.id,
    plan_id: localMembership.plan_id,
    start_date: localMembership.start_date,
    end_date: localMembership.end_date,
    discount_amount: 0,
    grace_days: 0,
    status: localMembership.status,
  };

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

  const { getPlanById } = await import("@/features/plans/actions/plan-actions");
  const planRow = await getPlanById(String(targetPlanId));

  if (!planRow) {
    throw new Error("Plan no encontrado");
  }

  const startDate =
    formatToLocalISO(params.data.start_date) ?? snapshot.subscription?.start_date ?? todayDateString();
  const endDate =
    formatToLocalISO(params.data.end_date) ??
    snapshot.subscription?.end_date ??
    addDaysToIsoDate(startDate, Number(planRow.duration_days || 30));
  const discountAmount = Number(params.data.discount_amount ?? snapshot.subscription?.discount_amount ?? 0);
  const graceDays = normalizeGraceDays(params.data.grace_days ?? snapshot.subscription?.grace_days);
  const amountOriginal = Number(planRow.price || 0);
  const amountPaid = Number(params.data.final_price ?? Math.max(0, amountOriginal - discountAmount));
  const paymentMethod = isPaymentMethod(params.data.payment_method)
    ? params.data.payment_method
    : isPaymentMethod(snapshot.payment?.method)
      ? snapshot.payment.method
      : "cash";
  const status = resolveSubscriptionStatus(endDate, graceDays);

  if (!snapshot.subscription) {
    const result = await createOrUpdateMembershipFromServer(params.customerId, {
      plan_id: Number(targetPlanId),
      start_date: startDate,
      end_date: endDate,
      price: amountPaid,
    });

    const subscriptionId = result.membership.id;
    if (!subscriptionId) {
      throw new Error("No se pudo crear la suscripción en el backend local");
    }

    const { data: paymentRow, error: paymentError } = await params.adminClient
      .from("payments")
      .insert({
        subscription_id: subscriptionId,
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
    normalizeGraceDays(snapshot.subscription.grace_days) !== graceDays ||
    snapshot.subscription.status !== status;

  if (subscriptionChanged) {
    await createOrUpdateMembershipFromServer(params.customerId, {
      plan_id: Number(targetPlanId),
      start_date: startDate,
      end_date: endDate,
      price: amountPaid,
    });
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
    grace_days: data.grace_days === undefined ? undefined : normalizeGraceDays(data.grace_days),
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
  const { data, error } = await adminClient
    .from("subscriptions")
    .select("id, end_date, grace_days")
    .eq("user_id", customerId)
    .eq("status", "active");

  if (error) {
    console.error(`Error loading overdue subscriptions for customer ${customerId}:`, error);
    return;
  }

  const today = todayDateString();
  const expiredIds = (data || [])
    .filter((subscription: { end_date?: string | null; grace_days?: number | null }) => {
      const accessUntil = getSubscriptionAccessUntilISO(subscription.end_date ?? null, subscription.grace_days);
      return Boolean(accessUntil && accessUntil < today);
    })
    .map((subscription: { id: string }) => subscription.id);

  if (expiredIds.length === 0) return;

  const { error: updateError } = await adminClient
    .from("subscriptions")
    .update({ status: "expired" })
    .in("id", expiredIds);

  if (updateError) {
    console.error(`Error expiring overdue subscriptions for customer ${customerId}:`, updateError);
  }
}

async function customerHasActiveSubscription(adminClient: AdminSupabaseClient, customerId: string) {
  const { data, error } = await adminClient
    .from("subscriptions")
    .select("id, end_date, grace_days")
    .eq("user_id", customerId)
    .eq("status", "active")
    .order("end_date", { ascending: false, nullsFirst: false });

  if (error) {
    console.error(`Error checking active subscription for customer ${customerId}:`, error);
    return false;
  }

  const today = todayDateString();
  return (data || []).some((subscription: { end_date?: string | null; grace_days?: number | null }) => {
    if (!subscription.end_date) return true;
    const accessUntil = getSubscriptionAccessUntilISO(subscription.end_date, subscription.grace_days);
    return Boolean(accessUntil && accessUntil >= today);
  });
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
  amount_original?: number;
  final_price?: number;
  discount_amount?: number;
  payment_method?: "cash" | "card" | "transfer";
  start_date?: Date;
  end_date?: Date;
  grace_days?: number;
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

type CreateCustomerActionResult =
  | {
      success: true;
      data: {
        user_id: string;
      };
      deviceSync: DeviceSyncResult;
    }
  | {
      success: false;
      error: string;
    };

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
  amountOriginal?: number;
  finalPrice?: number;
  discountAmount?: number;
  graceDays?: number;
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
      grace_days: normalizeGraceDays(params.graceDays),
    })
    .select("id")
    .single();

  if (subscriptionError || !subscription) {
    throw subscriptionError || new Error("No se pudo crear la suscripcion");
  }

  const amountOriginal = Number(params.amountOriginal ?? planData.price);
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
  amountOriginal?: number;
  finalPrice?: number;
  discountAmount?: number;
  graceDays?: number;
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
      amountOriginal: params.amountOriginal,
      finalPrice: params.finalPrice,
      discountAmount: params.discountAmount,
      graceDays: params.graceDays,
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

// Fase local ya cerrada: alta base del cliente sin membresia/pago/sync.
async function createCustomerWithLocalBaseFlow(data: CreateCustomerData): Promise<CreateCustomerActionResult> {
  const { serverCreateCustomer, extractCustomerErrorMessage } = await import(
    "@/features/customers/lib/customer-server-api"
  );

  try {
    const birthDate =
      typeof data.birth_date === "string"
        ? data.birth_date
        : formatToLocalISO(data.birth_date) ?? undefined;

    if (!birthDate) {
      return { success: false, error: "La fecha de nacimiento es obligatoria." };
    }

    const customer = await serverCreateCustomer({
      full_name: data.full_name,
      phone: data.phone,
      birth_date: birthDate,
      gender: data.gender,
      email: normalizeOptionalCustomerEmail(data.email),
      injuries: normalizeNullableText(data.injuries) ?? undefined,
      medical_notes: normalizeNullableText(data.medical_clearance_notes) ?? undefined,
    });

    revalidatePath("/panel/clientes");
    revalidatePath("/panel/resumen");

    return {
      success: true,
      data: {
        user_id: customer.id,
      },
      deviceSync: {
        attempted: false,
        method: "none",
        reason: "phase_a_without_biometric_sync",
      } satisfies DeviceSyncResult,
    };
  } catch (error) {
    console.error("Error creating customer in local base flow:", error);
    return {
      success: false,
      error: extractCustomerErrorMessage(error, "Error al crear el cliente."),
    };
  }
}

// Pendiente de migracion: caja/pagos/membresia/assessment/biometria siguen en Supabase.
async function createCustomerWithLegacyFinancialFlow(params: {
  accessUserId: string;
  data: CreateCustomerData;
}): Promise<CreateCustomerActionResult> {
  const { accessUserId, data } = params;

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
      amountOriginal: data.amount_original,
      finalPrice: data.final_price,
      discountAmount: data.discount_amount,
      graceDays: data.grace_days,
      paymentMethod: data.payment_method,
      requireSession: true,
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
      createdBy: accessUserId,
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
  return { success: true, data: { user_id: createdUserId! }, deviceSync };
}

export async function createCustomer(data: CreateCustomerData): Promise<CreateCustomerActionResult> {
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

    if (!isCashOrigin) {
      return createCustomerWithLocalBaseFlow(data);
    }

    return createCustomerWithLegacyFinancialFlow({
      accessUserId: access.userId,
      data,
    });
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
  const { serverGetCustomerById } = await import("@/features/customers/lib/customer-server-api");

  try {
    const customer = await serverGetCustomerById(id);
    return customer;
  } catch (error) {
    console.error("Error fetching customer by id from local backend:", error);
    return null;
  }
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
  const { serverUpdateCustomer, extractCustomerErrorMessage } = await import("@/features/customers/lib/customer-server-api");

  data = normalizeCustomerPayload(data);

  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated || !access.userId || !hasPermission(access, "customers.update")) {
      return { success: false, error: "No autorizado" };
    }

    const updatePayload: import("@/features/customers/lib/local-customers").UpdateCustomerInput = {};
    if (data.full_name !== undefined) updatePayload.full_name = data.full_name;
    if (data.phone !== undefined) updatePayload.phone = data.phone;
    if (data.birth_date !== undefined) {
      const formatted = typeof data.birth_date === "string" ? data.birth_date : formatToLocalISO(data.birth_date) ?? undefined;
      if (formatted) updatePayload.birth_date = formatted;
    }
    if (data.gender !== undefined) updatePayload.gender = data.gender;
    if (data.injuries !== undefined) updatePayload.injuries = data.injuries ?? null;
    if (data.medical_clearance_notes !== undefined) updatePayload.medical_notes = data.medical_clearance_notes ?? null;

    await serverUpdateCustomer(id, updatePayload);

    revalidatePath("/panel/clientes");
    revalidatePath(`/panel/clientes/${id}`);

    return { success: true };
  } catch (error) {
    console.error("Error in updateCustomer action:", error);
    return { success: false, error: extractCustomerErrorMessage(error, "Error al actualizar el cliente.") };
  }
}

export interface RenewSubscriptionData {
  origin?: "customers" | "cash";
  plan_id: number;
  start_date: Date;
  end_date: Date;
  price: number;
  discount_amount: number;
  grace_days: number;
  amount_paid: number;
  payment_method: "cash" | "card" | "transfer";
  // Physical Assessment
  weight_kg?: number;
  height_cm?: number;
  body_type?: BodyType;
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

function hasRenewalAssessmentMetrics(
  data: RenewSubscriptionData,
): data is RenewSubscriptionData & {
  weight_kg: number;
  height_cm: number;
  body_type: BodyType;
  diet_type: DietType;
  activity_level: ActivityLevel;
} {
  return (
    typeof data.weight_kg === "number" &&
    typeof data.height_cm === "number" &&
    data.body_type !== undefined &&
    data.diet_type !== undefined &&
    data.activity_level !== undefined
  );
}

async function renewSubscriptionWithPaymentLegacy(params: {
  financialClient: Awaited<ReturnType<typeof createClient>> | AdminSupabaseClient;
  customerId: string;
  data: RenewSubscriptionData;
}) {
  const { financialClient, customerId, data } = params;

  const { data: plan } = await financialClient
    .from("plans")
    .select("duration_days")
    .eq("id", data.plan_id)
    .single();

  const durationDays = plan?.duration_days || 30;
  const diffTime = Math.abs(new Date(data.end_date).getTime() - new Date(data.start_date).getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const cycles = Math.max(1, Math.round(diffDays / durationDays));

  const { serverRenewMembership } = await import("@/features/customers/lib/membership-server-api");
  const result = await serverRenewMembership(customerId, {
    plan_id: data.plan_id,
    cycles,
    start_date: formatToLocalISO(data.start_date) || undefined,
  });

  const subscriptionId = result.membership?.id;
  if (!subscriptionId) {
    throw new Error("No se pudo registrar la renovación en el backend local");
  }

  const { error: paymentError } = await financialClient.from("payments").insert({
    subscription_id: subscriptionId,
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

  return { subscriptionId };
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
        graceDays: data.grace_days,
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

    if (hasRenewalAssessmentMetrics(data)) {
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
    }

    try {
      const { data: existingTrainingProfile } = await supabase
        .from("training_profiles")
        .select("*")
        .eq("user_id", customerId)
        .maybeSingle();

      const trainingProfileUpdate = buildPartialTrainingProfileUpdate(data);

      if (Object.keys(trainingProfileUpdate).length > 0) {
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
            weightKg: data.weight_kg ?? null,
            heightCm: data.height_cm ?? null,
            bodyType: data.body_type ?? null,
            dietType: data.diet_type ?? null,
            activityLevel: data.activity_level ?? null,
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
  const { serverUpdateCustomerStatus, extractCustomerErrorMessage } = await import("@/features/customers/lib/customer-server-api");

  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !access.userId || !hasPermission(access, "customers.update")) {
    return { success: false, error: "No autorizado para desactivar clientes" };
  }

  try {
    await serverUpdateCustomerStatus(id, false);

    revalidatePath("/panel/clientes");
    revalidatePath(`/panel/clientes/${id}`);
    revalidatePath("/panel/resumen");
    return { success: true };
  } catch (error) {
    console.error("Exception in deleteCustomer:", error);
    return { success: false, error: extractCustomerErrorMessage(error, "Error inesperado al desactivar") };
  }
}

export async function reactivateCustomer(id: string) {
  const { serverUpdateCustomerStatus, extractCustomerErrorMessage } = await import("@/features/customers/lib/customer-server-api");

  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !access.userId || !hasPermission(access, "customers.update")) {
    return { success: false, error: "No autorizado para reactivar clientes" };
  }

  try {
    await serverUpdateCustomerStatus(id, true);

    revalidatePath("/panel/clientes");
    revalidatePath(`/panel/clientes/${id}`);
    revalidatePath("/panel/resumen");
    return { success: true };
  } catch (error) {
    console.error("Exception in reactivateCustomer:", error);
    return { success: false, error: extractCustomerErrorMessage(error, "Error inesperado al reactivar") };
  }
}

export async function permanentlyDeleteCustomer(id: string) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !access.userId || !(access.isOwner || access.role === "admin")) {
    return { success: false, error: "No autorizado para eliminar clientes permanentemente" };
  }

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
