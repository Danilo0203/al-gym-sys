"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, getUserEmail } from "@/lib/supabase/admin";
import { runPaymentsPostedQueryCompat } from "@/lib/payments/schema-compat";

type PlanSummary = { name?: string | null; price?: number | null };
type AttendanceLogRow = {
  id: number;
  punch_time: string;
  status1: number | null;
  raw_line: string | null;
};
const ACCESS_TIME_ZONE = "America/Guatemala";

function getPlanSummary(planRef: unknown): PlanSummary | null {
  if (!planRef) return null;
  if (Array.isArray(planRef)) {
    return (planRef[0] as PlanSummary | undefined) ?? null;
  }
  return planRef as PlanSummary;
}

function getDateFormatterParts(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ACCESS_TIME_ZONE,
    ...options,
  }).formatToParts(new Date(value));
}

function getLocalDateKey(value: string): string {
  const parts = getDateFormatterParts(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";

  return `${year}-${month}-${day}`;
}

function getLocalizedDayOfWeek(value: string): string {
  const formatted = new Intl.DateTimeFormat("es-GT", {
    timeZone: ACCESS_TIME_ZONE,
    weekday: "long",
  }).format(new Date(value));

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function isAuthorizedAccess(row: Pick<AttendanceLogRow, "status1" | "raw_line">): boolean {
  const rawLine = String(row.raw_line || "").toLowerCase();
  const isAccessControlEvent = rawLine.includes("pin=") && rawLine.includes("event=");

  if (isAccessControlEvent) {
    return row.status1 == null || row.status1 === 0;
  }

  // ATTLOG clásico no trae el mismo significado en status1; lo tratamos como ingreso válido.
  return true;
}

async function getCustomerBiometricId(customerId: string): Promise<number | null> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .select("biometric_id")
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching biometric id:", error.message);
    return null;
  }

  return typeof data?.biometric_id === "number" ? data.biometric_id : null;
}

async function getAttendanceLogsForCustomer(
  customerId: string,
  options: { limit?: number; since?: string } = {},
): Promise<AttendanceLogRow[]> {
  const biometricId = await getCustomerBiometricId(customerId);
  if (biometricId == null) return [];

  const adminClient = createAdminClient();
  let query = adminClient
    .from("attendance_logs")
    .select("id, punch_time, status1, raw_line")
    .eq("biometric_id", biometricId)
    .order("punch_time", { ascending: false });

  if (options.since) {
    query = query.gte("punch_time", options.since);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code !== "42P01") {
      console.error("Error fetching attendance logs:", error.message);
    }
    return [];
  }

  return (data || []) as AttendanceLogRow[];
}

// Tipos para el historial del cliente
export interface CustomerHistoryKPIs {
  totalSpent: number;
  memberSince: string | null;
  totalVisits: number;
  initialWeight: number | null;
  currentWeight: number | null;
  weightChange: number | null;
}

export interface AccessLogEntry {
  id: string;
  check_in_time: string;
  day_of_week: string;
  status: string;
}

export interface PaymentEntry {
  id: string;
  payment_date: string;
  plan_name: string;
  amount_original: number;
  amount_paid: number;
  discount_applied: number;
  payment_method: string;
  subscription_status: string;
  subscription_start: string;
  subscription_end: string;
}

export interface BodyAssessmentEntry {
  id: string;
  assessment_date: string;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_percentage: number | null;
  muscle_mass: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  hip_cm: number | null;
  arm_right_cm: number | null;
  arm_left_cm: number | null;
  leg_right_cm: number | null;
  leg_left_cm: number | null;
  activity_level: string | null;
  diet_type: string | null;
  daily_calories: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fat_grams: number | null;
  water_liters_goal: number | null;
  body_type: string | null;
}

export interface SubscriptionEntry {
  id: string;
  plan_id: number | null;
  plan_name: string;
  start_date: string;
  end_date: string;
  status: string;
  price: number;
  discount_amount: number;
}

export interface CustomerProfile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  avatar_url: string | null;
  gender: string | null;
  birth_date: string | null;
  created_at: string;
  is_active: boolean | null;
  subscription_status: string | null;
  subscription_end_date: string | null;
  injuries: string | null;
  medical_notes: string | null;
}

// Obtener perfil básico del cliente
export async function getCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customer_overview")
    .select("id, full_name, phone, avatar_url, gender, birth_date, is_active, subscription_status, subscription_end_date")
    .eq("id", customerId)
    .single();

  if (error || !data) {
    console.error("Error fetching customer profile:", error);
    return null;
  }

  // Obtener email desde auth.users
  const email = await getUserEmail(customerId);

  // Obtener fecha de creación del perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at, injuries, medical_notes")
    .eq("id", customerId)
    .single();

  return {
    ...data,
    email: email || null,
    created_at: profile?.created_at || null,
    is_active: data.is_active,
    subscription_status: data.subscription_status,
    subscription_end_date: data.subscription_end_date,
    injuries: profile?.injuries ?? null,
    medical_notes: profile?.medical_notes ?? null,
  };
}

// Obtener KPIs del cliente
export async function getCustomerKPIs(customerId: string): Promise<CustomerHistoryKPIs> {
  const supabase = await createClient();

  // Total gastado - intentar desde payments, fallback a suscripciones
  let totalSpent = 0;
  const { data: paymentsData, error: paymentsError } = await runPaymentsPostedQueryCompat((usePostedFilter) => {
    let query = supabase.from("payments").select("amount_paid").eq("user_id", customerId);

    if (usePostedFilter) {
      query = query.eq("status", "posted");
    }

    return query;
  });

  if (paymentsError) {
    // Fallback: calcular desde suscripciones
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("discount_amount, plans!inner(price)")
      .eq("user_id", customerId);

    totalSpent =
      subs?.reduce((sum, s) => {
        const plan = getPlanSummary(s.plans);
        const price = plan?.price || 0;
        const discount = s.discount_amount || 0;
        return sum + (price - discount);
      }, 0) || 0;
  } else {
    totalSpent = paymentsData?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;
  }

  // Fecha de creación de cuenta
  const { data: profileData } = await supabase.from("profiles").select("created_at").eq("id", customerId).single();

  let totalVisits = 0;
  const biometricId = await getCustomerBiometricId(customerId);
  if (biometricId != null) {
    const adminClient = createAdminClient();
    const { count, error: attendanceError } = await adminClient
      .from("attendance_logs")
      .select("id", { count: "exact", head: true })
      .eq("biometric_id", biometricId)
      .or("status1.is.null,status1.eq.0");

    if (!attendanceError) {
      totalVisits = count || 0;
    } else if (attendanceError.code !== "42P01") {
      console.error("Error counting attendance logs:", attendanceError.message);
    }
  }

  // Peso inicial y actual
  const { data: assessments } = await supabase
    .from("body_assessments")
    .select("weight_kg, date")
    .eq("user_id", customerId)
    .order("date", { ascending: true });

  const initialWeight = assessments?.[0]?.weight_kg || null;
  const currentWeight = assessments?.[assessments.length - 1]?.weight_kg || null;
  const weightChange = initialWeight && currentWeight ? currentWeight - initialWeight : null;

  return {
    totalSpent,
    memberSince: profileData?.created_at || null,
    totalVisits,
    initialWeight,
    currentWeight,
    weightChange,
  };
}

// Obtener historial de accesos
export async function getAccessHistory(customerId: string, limit = 50): Promise<AccessLogEntry[]> {
  const data = await getAttendanceLogsForCustomer(customerId, { limit });

  return data.map((log) => {
    return {
      id: String(log.id),
      check_in_time: log.punch_time,
      day_of_week: getLocalizedDayOfWeek(log.punch_time),
      status: isAuthorizedAccess(log) ? "authorized" : "denied",
    };
  });
}

// Obtener historial de pagos - Si no existe tabla payments, usar suscripciones como fuente
export async function getPaymentHistory(customerId: string): Promise<PaymentEntry[]> {
  const supabase = await createClient();

  // Obtener de la tabla payments con las columnas correctas
  const { data, error } = await runPaymentsPostedQueryCompat((usePostedFilter) => {
    let query = supabase
      .from("payments")
      .select(
        `
        id,
        payment_date,
        amount_original,
        discount_amount,
        amount_paid,
        method,
        subscription_id,
        subscriptions (
          status,
          start_date,
          end_date,
          plan_id,
          plans (
            name
          )
        )
      `,
      )
      .eq("user_id", customerId)
      .order("payment_date", { ascending: false });

    if (usePostedFilter) {
      query = query.eq("status", "posted");
    }

    return query;
  });

  // Si la tabla no existe o hay error, intentar construir desde suscripciones
  if (error) {
    // Silenciar el error si es porque la tabla no existe
    if (error.code !== "42P01") {
      console.error("Error fetching payment history:", error.message);
    }

    // Fallback: construir historial desde suscripciones
    const { data: subs } = await supabase
      .from("subscriptions")
      .select(
        `
        id,
        start_date,
        end_date,
        status,
        discount_amount,
        created_at,
        plans!inner (
          name,
          price
        )
      `,
      )
      .eq("user_id", customerId)
      .order("created_at", { ascending: false });

    if (!subs) return [];

    return subs.map((sub) => {
      const plan = getPlanSummary(sub.plans);
      const planPrice = plan?.price || 0;
      return {
      id: sub.id,
      payment_date: sub.created_at,
      plan_name: plan?.name || "N/A",
      amount_original: planPrice,
      amount_paid: planPrice - (sub.discount_amount || 0),
      discount_applied: sub.discount_amount || 0,
      payment_method: "N/A",
      subscription_status: sub.status,
      subscription_start: sub.start_date,
      subscription_end: sub.end_date,
      };
    });
  }

  return (data || []).map((payment) => {
    const subscription = Array.isArray(payment.subscriptions) ? payment.subscriptions[0] : payment.subscriptions;
    const plan = Array.isArray(subscription?.plans) ? subscription?.plans[0] : subscription?.plans;

    return {
      id: payment.id,
      payment_date: payment.payment_date,
      plan_name: plan?.name || "N/A",
      amount_original: payment.amount_original || 0,
      amount_paid: payment.amount_paid || 0,
      discount_applied: payment.discount_amount || 0,
      payment_method: payment.method || "cash",
      subscription_status: subscription?.status || "N/A",
      subscription_start: subscription?.start_date || "",
      subscription_end: subscription?.end_date || "",
    };
  });
}

// Obtener historial de suscripciones
export async function getSubscriptionHistory(customerId: string): Promise<SubscriptionEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      start_date,
      end_date,
      status,
      discount_amount,
      plan_id,
      plans!inner (
        name,
        price
      )
    `,
    )
    .eq("user_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching subscription history:", error);
    return [];
  }

  return (data || []).map((sub) => {
    const plan = getPlanSummary(sub.plans);
    return {
      id: sub.id,
      plan_id: typeof sub.plan_id === "number" ? sub.plan_id : null,
      plan_name: plan?.name || "N/A",
      start_date: sub.start_date,
      end_date: sub.end_date,
      status: sub.status,
      price: plan?.price || 0,
      discount_amount: sub.discount_amount || 0,
    };
  });
}

// Obtener historial de evaluaciones físicas
export async function getBodyAssessmentHistory(customerId: string): Promise<BodyAssessmentEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("body_assessments")
    .select(
      `
      id, 
      user_id, 
      date, 
      weight_kg, 
      height_cm, 
      body_fat_percentage,
      muscle_mass_kg,
      body_type,
      chest,
      waist,
      hip,
      arm_right,
      arm_left,
      leg_right,
      leg_left,
      activity_level,
      diet_type,
      daily_calories,
      protein_grams,
      carbs_grams,
      fat_grams,
      water_liters_goal
    `,
    )
    .eq("user_id", customerId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching body assessments:", error);
    return [];
  }

  return (data || []).map((assessment) => ({
    id: assessment.id,
    assessment_date: assessment.date,
    weight_kg: assessment.weight_kg,
    height_cm: assessment.height_cm,
    body_fat_percentage: assessment.body_fat_percentage,
    muscle_mass: assessment.muscle_mass_kg,
    waist_cm: assessment.waist,
    chest_cm: assessment.chest,
    arm_cm: assessment.arm_right,
    hip_cm: assessment.hip,
    arm_right_cm: assessment.arm_right,
    arm_left_cm: assessment.arm_left,
    leg_right_cm: assessment.leg_right,
    leg_left_cm: assessment.leg_left,
    activity_level: assessment.activity_level,
    diet_type: assessment.diet_type,
    daily_calories: assessment.daily_calories,
    protein_grams: assessment.protein_grams,
    carbs_grams: assessment.carbs_grams,
    fat_grams: assessment.fat_grams,
    water_liters_goal: assessment.water_liters_goal,
    body_type: assessment.body_type,
  }));
}

// Obtener datos para el calendario de calor (últimos 12 meses)
export async function getAccessHeatmapData(customerId: string): Promise<Record<string, number>> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const heatmap: Record<string, number> = {};

  const data = await getAttendanceLogsForCustomer(customerId, {
    since: oneYearAgo.toISOString(),
  });

  data.forEach((log) => {
    if (!isAuthorizedAccess(log)) return;

    const date = getLocalDateKey(log.punch_time);
    heatmap[date] = (heatmap[date] || 0) + 1;
  });

  return heatmap;
}
