import type { NutritionContext, TrainingProfileInput } from "@/lib/training/types";
import { DEFAULT_TRAINING_LOCATION } from "@/lib/training/profile-defaults";

export function normalizeTextArray(value: string[] | null | undefined) {
  if (!value) return [];
  return value.map((item) => item.trim()).filter(Boolean);
}

export function normalizeNullableText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeTrainingProfileInput(input: TrainingProfileInput): TrainingProfileInput {
  const parqRequiresAttention = input.parq_requires_attention ?? null;
  const injuriesOrPain = parqRequiresAttention === false ? null : normalizeNullableText(input.injuries_or_pain);
  const medicalClearanceNotes =
    parqRequiresAttention === false ? null : normalizeNullableText(input.medical_clearance_notes);

  return {
    primary_goal: input.primary_goal ?? null,
    secondary_goal: input.secondary_goal ?? null,
    focus_areas: normalizeTextArray(input.focus_areas) as TrainingProfileInput["focus_areas"],
    experience_level: input.experience_level ?? null,
    days_per_week: input.days_per_week ?? null,
    session_minutes: input.session_minutes ?? null,
    training_location: input.training_location ?? DEFAULT_TRAINING_LOCATION,
    equipment_available: normalizeTextArray(input.equipment_available) as TrainingProfileInput["equipment_available"],
    activity_level: input.activity_level ?? null,
    cardio_preference: input.cardio_preference ?? null,
    exercise_preferences: normalizeNullableText(input.exercise_preferences),
    exercise_dislikes: normalizeNullableText(input.exercise_dislikes),
    injuries_or_pain: injuriesOrPain,
    restricted_movements: normalizeTextArray(input.restricted_movements) as TrainingProfileInput["restricted_movements"],
    parq_requires_attention: parqRequiresAttention,
    medical_clearance_notes: medicalClearanceNotes,
  };
}

export function getMissingTrainingProfileRequirements(input: TrainingProfileInput, nutrition: NutritionContext = {}) {
  const missing: string[] = [];
  const normalized = normalizeTrainingProfileInput(input);

  if (!nutrition.birthDate) missing.push("Fecha de nacimiento");
  if (!nutrition.gender) missing.push("Género");
  if (!nutrition.weightKg) missing.push("Peso");
  if (!nutrition.heightCm) missing.push("Estatura");
  if (!normalized.primary_goal) missing.push("Objetivo principal");
  if (normalized.parq_requires_attention === null) missing.push("Screening PAR-Q");
  if (normalized.parq_requires_attention === true && !normalized.injuries_or_pain) {
    missing.push("Motivo de la atención especial");
  }
  if (!normalized.experience_level) missing.push("Nivel de experiencia");
  if (!normalized.days_per_week) missing.push("Días por semana");
  if (!normalized.session_minutes) missing.push("Duración por sesión");
  if (!normalized.activity_level) missing.push("Nivel de actividad");
  if (!normalized.cardio_preference) missing.push("Preferencia de cardio");

  if (
    normalized.training_location &&
    normalized.training_location !== "gym" &&
    normalizeTextArray(normalized.equipment_available).length === 0
  ) {
    missing.push("Equipo disponible");
  }

  return missing;
}

export function isTrainingProfileComplete(input: TrainingProfileInput, nutrition: NutritionContext = {}) {
  return getMissingTrainingProfileRequirements(input, nutrition).length === 0;
}
