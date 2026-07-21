"use client";

import {
  createCustomer,
  renewSubscription,
  updateCustomer,
  type CreateCustomerData,
} from "@/features/customers/actions/customer-actions";
import type { CustomerSheetFormValues } from "@/features/customers/hooks/use-hook-form-customers";
import { poundsToKilograms } from "@/lib/fitness/measurements";
import { combineSessionDuration, DEFAULT_TRAINING_LOCATION } from "@/lib/training/profile-defaults";

function normalizeTextFieldValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export async function submitLegacyCashCustomer(
  customerId: string | null,
  values: CustomerSheetFormValues,
  context: { entrypoint: "cash"; suggestedBasePrice?: number },
) {
  const customerPayload: CreateCustomerData = {
    email: values.email || undefined,
    origin: context.entrypoint,
    password: values.password || undefined,
    full_name: values.full_name,
    phone: values.phone,
    birth_date: values.birth_date,
    gender: values.gender,
    payment_method: values.payment_method,
    discount_amount: values.discount_amount,
    amount_original:
      values.final_price !== undefined
        ? Math.max(0, values.final_price + (Number(values.discount_amount) || 0))
        : context.suggestedBasePrice,
    grace_days: values.grace_days,
    plan_id: values.plan_id ? Number(values.plan_id) : undefined,
    final_price: values.final_price,
    start_date: values.subscription_period?.from,
    end_date: values.subscription_period?.to,
    primary_goal: values.primary_goal,
    secondary_goal: values.secondary_goal,
    focus_areas: values.focus_areas,
    experience_level: values.experience_level,
    days_per_week: values.days_per_week ? Number(values.days_per_week) : undefined,
    session_minutes: combineSessionDuration(values.session_hours, values.session_minutes_extra) ?? undefined,
    training_location: DEFAULT_TRAINING_LOCATION,
    equipment_available: values.equipment_available,
    cardio_preference: values.cardio_preference,
    parq_requires_attention:
      values.parq_requires_attention === "yes"
        ? true
        : values.parq_requires_attention === "no"
          ? false
          : undefined,
    restricted_movements: values.restricted_movements,
    exercise_preferences: normalizeTextFieldValue(values.exercise_preferences),
    exercise_dislikes: normalizeTextFieldValue(values.exercise_dislikes),
    injuries_or_pain:
      values.parq_requires_attention === "yes" ? normalizeTextFieldValue(values.injuries_or_pain) : "",
    medical_clearance_notes:
      values.parq_requires_attention === "yes" ? normalizeTextFieldValue(values.medical_clearance_notes) : "",
    weight_kg: poundsToKilograms(values.weight_lb) ?? undefined,
    height_cm: values.height_cm,
    diet_type: values.diet_type,
    activity_level: values.activity_level,
    body_fat_percentage: values.body_fat_percentage,
    muscle_mass_kg: values.muscle_mass_kg,
    chest: values.chest,
    waist: values.waist,
    hip: values.hip,
    arm_right: values.arm_right,
    arm_left: values.arm_left,
    leg_right: values.leg_right,
    leg_left: values.leg_left,
    injuries: normalizeTextFieldValue(values.injuries),
    body_type: values.body_type,
  };

  if (customerId) {
    await updateCustomer(customerId, customerPayload);
    return;
  }

  await createCustomer(customerPayload);
}

export async function renewLegacyCashCustomer(
  customerId: string,
  payload: Record<string, unknown>,
) {
  return renewSubscription(
    customerId,
    payload as unknown as Parameters<typeof renewSubscription>[1],
  );
}
