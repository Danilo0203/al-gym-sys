import {
  getCustomerBodyAssessments,
  getCustomerDetail,
  getCustomerHealthProfile,
} from "./customer-api";
import type { CustomerData } from "../hooks/use-hook-form-customers";
import type { EquipmentOption, FocusArea, PrimaryGoal, RestrictedMovement } from "@/lib/training/types";

function parseRestrictedMovements(value: string | null): RestrictedMovement[] {
  if (!value) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean) as RestrictedMovement[];
}

export async function getCustomerFormPrefill(customerId: string): Promise<CustomerData> {
  const detail = await getCustomerDetail(customerId);
  const [healthProfile, assessments] = await Promise.all([
    detail.capabilities.view_health_profile ? getCustomerHealthProfile(customerId) : null,
    detail.capabilities.view_body_assessments ? getCustomerBodyAssessments(customerId, 1, 1) : null,
  ]);
  const latestAssessment = assessments?.data[0];

  return {
    id: detail.id,
    is_active: detail.is_active,
    email: detail.account.email ?? detail.email,
    full_name: detail.full_name,
    phone: detail.phone,
    birth_date: detail.birth_date,
    gender: detail.gender,
    emergency_contact: null,
    emergency_phone: null,
    injuries: detail.injuries,
    medical_notes: detail.medical_notes,
    plan_id: detail.current_membership?.plan_id ?? null,
    subscription_start_date: detail.current_membership?.start_date ?? null,
    subscription_end_date: detail.current_membership?.end_date ?? null,
    subscription_grace_days: detail.current_membership?.grace_days ?? null,
    primary_goal: (healthProfile?.primary_goal as PrimaryGoal | null) ?? null,
    secondary_goal: (healthProfile?.secondary_goal as PrimaryGoal | null) ?? null,
    focus_areas: (healthProfile?.focus_areas as FocusArea[] | null) ?? [],
    experience_level: (healthProfile?.experience_level as CustomerData["experience_level"]) ?? null,
    days_per_week: healthProfile?.days_per_week ?? null,
    session_minutes: healthProfile?.session_minutes ?? null,
    training_location: (healthProfile?.training_location as CustomerData["training_location"]) ?? null,
    equipment_available: (healthProfile?.equipment_available as EquipmentOption[] | null) ?? [],
    cardio_preference: (healthProfile?.cardio_preference as CustomerData["cardio_preference"]) ?? null,
    parq_requires_attention: healthProfile?.parq_requires_attention ?? null,
    restricted_movements: parseRestrictedMovements(healthProfile?.restricted_movements ?? null),
    exercise_preferences: healthProfile?.exercise_preferences ?? null,
    exercise_dislikes: healthProfile?.exercise_dislikes ?? null,
    injuries_or_pain: healthProfile?.injuries_or_pain ?? null,
    medical_clearance_notes: healthProfile?.medical_clearance_notes ?? null,
    weight_kg: latestAssessment?.weight_kg ?? null,
    height_cm: latestAssessment?.height_cm ?? null,
    body_type: latestAssessment?.body_type ?? latestAssessment?.nutrition_snapshot?.body_type ?? null,
    diet_type: healthProfile?.diet_type ?? latestAssessment?.diet_type ?? latestAssessment?.nutrition_snapshot?.diet_type ?? null,
    activity_level: healthProfile?.activity_level ?? latestAssessment?.activity_level ?? latestAssessment?.nutrition_snapshot?.activity_level ?? null,
    body_fat_percentage: latestAssessment?.body_fat_percentage ?? null,
    muscle_mass_kg: latestAssessment?.muscle_mass_kg ?? null,
    chest: latestAssessment?.chest ?? null,
    waist: latestAssessment?.waist ?? null,
    hip: latestAssessment?.hip ?? null,
    arm_right: latestAssessment?.arm_right ?? null,
    arm_left: latestAssessment?.arm_left ?? null,
    leg_right: latestAssessment?.leg_right ?? null,
    leg_left: latestAssessment?.leg_left ?? null,
  };
}
