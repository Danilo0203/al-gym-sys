import { z } from "zod";

function isValidCalendarDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const nullableText = (maximum: number) => z.string().max(maximum).nullable();
const nullablePositiveNumber = (maximum: number) => z.number()
  .positive("El valor debe ser mayor que cero.")
  .max(maximum, `El valor no puede superar ${maximum}.`)
  .nullable();

export const customerHealthProfileStatusSchema = z.enum([
  "pending",
  "completed",
  "requires_attention",
]);

export const customerHealthProfileSchema = z.object({
  customer_id: z.uuid(),
  parq_requires_attention: z.boolean().nullable(),
  parq_details: z.string().nullable(),
  injuries_or_pain: z.string().nullable(),
  medical_conditions: z.string().nullable(),
  medications: z.string().nullable(),
  medical_clearance_notes: z.string().nullable(),
  restricted_movements: z.string().nullable(),
  primary_goal: z.string().nullable(),
  secondary_goal: z.string().nullable(),
  focus_areas: z.array(z.string()).nullable(),
  experience_level: z.string().nullable(),
  days_per_week: z.number().int().min(1).max(7).nullable(),
  session_minutes: z.number().int().min(15).max(480).nullable(),
  training_location: z.string().nullable(),
  equipment_available: z.array(z.string()).nullable(),
  cardio_preference: z.string().nullable(),
  exercise_preferences: z.string().nullable(),
  exercise_dislikes: z.string().nullable(),
  diet_type: z.string().nullable(),
  activity_level: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
}).strict();

function normalizeNullableText(value: string | null): string | null {
  if (value === null) return null;
  return value.trim() || null;
}

function normalizeNullableTextArray(value: string[] | null): string[] | null {
  if (value === null) return null;
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

const shortNullableText = nullableText(500).transform(normalizeNullableText);
const longNullableText = nullableText(5_000).transform(normalizeNullableText);
const nullableTextArray = z.array(z.string().max(200)).max(100).nullable().transform(normalizeNullableTextArray);

export const customerHealthProfileUpdateSchema = z.object({
  parq_requires_attention: z.boolean().nullable().optional(),
  parq_details: longNullableText.optional(),
  injuries_or_pain: longNullableText.optional(),
  medical_conditions: longNullableText.optional(),
  medications: longNullableText.optional(),
  medical_clearance_notes: longNullableText.optional(),
  restricted_movements: longNullableText.optional(),
  primary_goal: shortNullableText.optional(),
  secondary_goal: shortNullableText.optional(),
  focus_areas: nullableTextArray.optional(),
  experience_level: shortNullableText.optional(),
  days_per_week: z.number().int("Debe ser un número entero.").min(1, "Debe ser al menos 1.").max(7, "No puede superar 7.").nullable().optional(),
  session_minutes: z.number().int("Debe ser un número entero.").min(15, "Debe ser al menos 15.").max(480, "No puede superar 480.").nullable().optional(),
  training_location: shortNullableText.optional(),
  equipment_available: nullableTextArray.optional(),
  cardio_preference: shortNullableText.optional(),
  exercise_preferences: longNullableText.optional(),
  exercise_dislikes: longNullableText.optional(),
  diet_type: shortNullableText.optional(),
  activity_level: shortNullableText.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "No hay cambios para guardar.",
  path: ["body"],
});

export const bodyAssessmentNutritionSnapshotSchema = z.object({
  body_type: z.string().nullable(),
  activity_level: z.string().nullable(),
  water_liters_goal: z.number().nullable(),
  daily_calories: z.number().int().nullable(),
  protein_grams: z.number().int().nullable(),
  carbs_grams: z.number().int().nullable(),
  fat_grams: z.number().int().nullable(),
  diet_type: z.string().nullable(),
}).strict();

export const customerBodyAssessmentSchema = z.object({
  id: z.uuid(),
  customer_id: z.uuid(),
  assessment_date: z.string().refine(isValidCalendarDateString).nullable(),
  weight_kg: z.number().nullable(),
  height_cm: z.number().nullable(),
  body_fat_percentage: z.number().nullable(),
  muscle_mass_kg: z.number().nullable(),
  chest: z.number().nullable(),
  waist: z.number().nullable(),
  hip: z.number().nullable(),
  arm_right: z.number().nullable(),
  arm_left: z.number().nullable(),
  leg_right: z.number().nullable(),
  leg_left: z.number().nullable(),
  notes: z.string().nullable(),
  body_type: z.string().nullable(),
  activity_level: z.string().nullable(),
  water_liters_goal: z.number().nullable(),
  daily_calories: z.number().int().nullable(),
  protein_grams: z.number().int().nullable(),
  carbs_grams: z.number().int().nullable(),
  fat_grams: z.number().int().nullable(),
  diet_type: z.string().nullable(),
  nutrition_snapshot: bodyAssessmentNutritionSnapshotSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).strict();

const optionalNutritionSnapshotSchema = z.object({
  body_type: shortNullableText.optional(),
  activity_level: shortNullableText.optional(),
  water_liters_goal: nullablePositiveNumber(30).optional(),
  daily_calories: z.number().int("Debe ser un número entero.").min(0, "No puede ser negativo.").max(30_000, "El valor es demasiado alto.").nullable().optional(),
  protein_grams: z.number().int("Debe ser un número entero.").min(0, "No puede ser negativo.").max(10_000, "El valor es demasiado alto.").nullable().optional(),
  carbs_grams: z.number().int("Debe ser un número entero.").min(0, "No puede ser negativo.").max(10_000, "El valor es demasiado alto.").nullable().optional(),
  fat_grams: z.number().int("Debe ser un número entero.").min(0, "No puede ser negativo.").max(10_000, "El valor es demasiado alto.").nullable().optional(),
  diet_type: shortNullableText.optional(),
}).strict();

const bodyAssessmentWriteFields = {
  assessment_date: z.string().refine(isValidCalendarDateString, "Fecha inválida.").optional(),
  weight_kg: nullablePositiveNumber(700).optional(),
  height_cm: nullablePositiveNumber(300).optional(),
  body_fat_percentage: z.number().min(0, "No puede ser negativo.").max(100, "No puede superar 100%.").nullable().optional(),
  muscle_mass_kg: nullablePositiveNumber(500).optional(),
  chest: nullablePositiveNumber(500).optional(),
  waist: nullablePositiveNumber(500).optional(),
  hip: nullablePositiveNumber(500).optional(),
  arm_right: nullablePositiveNumber(500).optional(),
  arm_left: nullablePositiveNumber(500).optional(),
  leg_right: nullablePositiveNumber(500).optional(),
  leg_left: nullablePositiveNumber(500).optional(),
  notes: longNullableText.optional(),
  nutrition_snapshot: optionalNutritionSnapshotSchema.nullable().optional(),
};

function hasAssessmentContent(value: Record<string, unknown> & {
  nutrition_snapshot?: Record<string, unknown> | null;
}): boolean {
  const measurements = [
    "weight_kg", "height_cm", "body_fat_percentage", "muscle_mass_kg", "chest", "waist",
    "hip", "arm_right", "arm_left", "leg_right", "leg_left",
  ] as const;
  if (measurements.some((field) => value[field] !== undefined && value[field] !== null)) return true;
  if (value.notes !== undefined && value.notes !== null) return true;
  return value.nutrition_snapshot !== undefined && value.nutrition_snapshot !== null &&
    Object.values(value.nutrition_snapshot).some((item) => item !== null && item !== undefined);
}

export const bodyAssessmentCreateSchema = z.object(bodyAssessmentWriteFields).strict().refine(hasAssessmentContent, {
  message: "Ingresa al menos una medición, nota o dato nutricional.",
  path: ["body"],
});

export const bodyAssessmentUpdateSchema = z.object(bodyAssessmentWriteFields).strict().refine(
  (value) => Object.keys(value).length > 0,
  { message: "No hay cambios para guardar.", path: ["body"] },
);

export const bodyAssessmentsResponseSchema = z.object({
  data: z.array(customerBodyAssessmentSchema),
  meta: z.object({
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    total_pages: z.number().int().nonnegative(),
  }).strict(),
}).strict();

export const customerIdSchema = z.uuid();
export const bodyAssessmentIdSchema = z.uuid();
export const bodyAssessmentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(1000).default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
}).strict();

export type CustomerHealthProfile = z.infer<typeof customerHealthProfileSchema>;
export type CustomerHealthProfileUpdateInput = z.input<typeof customerHealthProfileUpdateSchema>;
export type CustomerBodyAssessment = z.infer<typeof customerBodyAssessmentSchema>;
export type BodyAssessmentsResponse = z.infer<typeof bodyAssessmentsResponseSchema>;
export type BodyAssessmentWriteInput = z.input<typeof bodyAssessmentCreateSchema>;
