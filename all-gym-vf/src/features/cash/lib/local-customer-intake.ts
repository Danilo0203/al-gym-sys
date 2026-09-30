import type {
  CreateCustomerData,
  RenewSubscriptionData,
} from "@/features/customers/actions/customer-actions";

type CashCustomerData = CreateCustomerData | RenewSubscriptionData;

function calendarDate(value: Date | undefined, label: string): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${label} no es válida.`);
  }
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function nonEmpty(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function buildIntake(data: CashCustomerData, isRenewal: boolean) {
  const healthProfile = {
    ...(data.parq_requires_attention !== undefined && { parq_requires_attention: data.parq_requires_attention }),
    ...(data.injuries_or_pain !== undefined && { injuries_or_pain: nonEmpty(data.injuries_or_pain) ?? null }),
    ...(data.medical_clearance_notes !== undefined && { medical_clearance_notes: nonEmpty(data.medical_clearance_notes) ?? null }),
    ...(data.primary_goal !== undefined && { primary_goal: data.primary_goal }),
    ...(data.secondary_goal !== undefined && { secondary_goal: data.secondary_goal }),
    ...(data.focus_areas !== undefined && { focus_areas: data.focus_areas }),
    ...(data.experience_level !== undefined && { experience_level: data.experience_level }),
    ...(data.days_per_week !== undefined && { days_per_week: data.days_per_week }),
    ...(data.session_minutes !== undefined && data.session_minutes >= 15 && { session_minutes: data.session_minutes }),
    ...(data.training_location !== undefined && { training_location: data.training_location }),
    ...(data.equipment_available !== undefined && { equipment_available: data.equipment_available }),
    ...(data.cardio_preference !== undefined && { cardio_preference: data.cardio_preference }),
    ...(data.exercise_preferences !== undefined && { exercise_preferences: nonEmpty(data.exercise_preferences) ?? null }),
    ...(data.exercise_dislikes !== undefined && { exercise_dislikes: nonEmpty(data.exercise_dislikes) ?? null }),
    ...(data.diet_type !== undefined && { diet_type: data.diet_type }),
    ...(data.activity_level !== undefined && { activity_level: data.activity_level }),
    ...(data.restricted_movements !== undefined && { restricted_movements: data.restricted_movements.join(", ") }),
  };

  const trainingFields = { ...healthProfile };
  delete trainingFields.diet_type;
  delete trainingFields.restricted_movements;
  const trainingProfile = {
    ...trainingFields,
    ...(data.session_minutes !== undefined && { session_minutes: data.session_minutes }),
    ...(data.restricted_movements !== undefined && { restricted_movements: data.restricted_movements }),
  };

  const measurements = {
    ...(data.weight_kg !== undefined && { weight_kg: data.weight_kg }),
    ...(data.height_cm !== undefined && { height_cm: data.height_cm }),
    ...(data.body_fat_percentage !== undefined && { body_fat_percentage: data.body_fat_percentage }),
    ...(data.muscle_mass_kg !== undefined && { muscle_mass_kg: data.muscle_mass_kg }),
    ...(data.chest !== undefined && { chest: data.chest }),
    ...(data.waist !== undefined && { waist: data.waist }),
    ...(data.hip !== undefined && { hip: data.hip }),
    ...(data.arm_right !== undefined && { arm_right: data.arm_right }),
    ...(data.arm_left !== undefined && { arm_left: data.arm_left }),
    ...(data.leg_right !== undefined && { leg_right: data.leg_right }),
    ...(data.leg_left !== undefined && { leg_left: data.leg_left }),
  };
  const nutritionSnapshot = {
    ...(data.body_type !== undefined && { body_type: data.body_type }),
    ...(data.diet_type !== undefined && { diet_type: data.diet_type }),
    ...(data.activity_level !== undefined && { activity_level: data.activity_level }),
  };
  const bodyAssessment = {
    ...measurements,
    ...(Object.keys(nutritionSnapshot).length > 0 && { nutrition_snapshot: nutritionSnapshot }),
  };
  const profileUpdate = isRenewal
    ? {
        ...(data.injuries !== undefined && { injuries: nonEmpty(data.injuries) ?? null }),
        ...(data.medical_clearance_notes !== undefined && { medical_notes: nonEmpty(data.medical_clearance_notes) ?? null }),
      }
    : undefined;

  return {
    ...(profileUpdate && Object.keys(profileUpdate).length > 0 && { profile_update: profileUpdate }),
    ...(Object.keys(healthProfile).length > 0 && { health_profile: healthProfile }),
    ...(Object.keys(bodyAssessment).length > 0 && { body_assessment: bodyAssessment }),
    ...(Object.keys(trainingProfile).length > 0 && { training_profile: trainingProfile }),
  };
}

export function buildCashCustomerCreatePayload(data: CreateCustomerData) {
  if (!data.plan_id) throw new Error("Selecciona un plan para cobrar el alta.");
  if (!data.birth_date) throw new Error("La fecha de nacimiento es obligatoria.");
  if (!data.start_date || !data.end_date) throw new Error("Selecciona el período de la membresía.");
  const intake = buildIntake(data, false);
  return {
    full_name: data.full_name.trim(),
    phone: data.phone.trim(),
    birth_date: calendarDate(data.birth_date, "La fecha de nacimiento"),
    gender: data.gender,
    ...(nonEmpty(data.email) && { email: nonEmpty(data.email) }),
    ...(data.password && { password: data.password }),
    ...(nonEmpty(data.injuries) && { injuries: nonEmpty(data.injuries) }),
    ...(nonEmpty(data.medical_clearance_notes) && { medical_notes: nonEmpty(data.medical_clearance_notes) }),
    paid_membership: {
      planId: data.plan_id,
      startDate: calendarDate(data.start_date, "La fecha de inicio"),
      endDate: calendarDate(data.end_date, "La fecha de fin"),
      amountOriginal: data.amount_original,
      discountAmount: data.discount_amount ?? 0,
      amountPaid: data.final_price,
      graceDays: data.grace_days ?? 3,
      paymentMethod: data.payment_method ?? "cash",
      requireSession: true as const,
    },
    ...(Object.keys(intake).length > 0 && { intake }),
  };
}

export function buildCashCustomerRenewalPayload(customerId: string, data: RenewSubscriptionData) {
  const intake = buildIntake(data, true);
  return {
    customerId,
    planId: data.plan_id,
    operation: "renew" as const,
    startDate: calendarDate(data.start_date, "La fecha de inicio"),
    endDate: calendarDate(data.end_date, "La fecha de fin"),
    amountOriginal: data.price,
    discountAmount: data.discount_amount,
    amountPaid: data.amount_paid,
    graceDays: data.grace_days,
    paymentMethod: data.payment_method,
    requireSession: true,
    ...(Object.keys(intake).length > 0 && { intake }),
  };
}
