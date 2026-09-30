import { z } from "zod";

const nullableNumberSchema = z.number().nullable();

export const customerProfileSchema = z.object({
  id: z.uuid(),
  full_name: z.string(),
  email: z.string().email().nullable(),
  phone: z.string(),
  avatar_url: z.string().nullable(),
  gender: z.string().nullable(),
  birth_date: z.string().nullable(),
  created_at: z.string(),
  is_active: z.boolean(),
  subscription_status: z.string().nullable(),
  subscription_end_date: z.string().nullable(),
  subscription_grace_days: z.number().int().nullable(),
  subscription_access_until: z.string().nullable(),
  injuries: z.string().nullable(),
  medical_notes: z.string().nullable(),
});

export const customerHistoryKpisSchema = z.object({
  totalSpent: z.number(),
  memberSince: z.string().nullable(),
  totalVisits: z.number().int().nonnegative(),
  initialWeight: nullableNumberSchema,
  currentWeight: nullableNumberSchema,
  weightChange: nullableNumberSchema,
});

export const accessLogEntrySchema = z.object({
  id: z.string(),
  check_in_time: z.string(),
  day_of_week: z.string(),
  status: z.enum(["authorized", "denied"]),
});

export const paymentEntrySchema = z.object({
  id: z.uuid(),
  payment_date: z.string(),
  plan_name: z.string(),
  amount_original: z.number(),
  amount_paid: z.number(),
  discount_applied: z.number(),
  payment_method: z.string(),
  subscription_status: z.string(),
  subscription_start: z.string(),
  subscription_end: z.string(),
});

export const subscriptionEntrySchema = z.object({
  id: z.uuid(),
  plan_id: z.number().int().nullable(),
  plan_name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  grace_days: z.number().int().nullable(),
  access_until: z.string().nullable(),
  status: z.string(),
  price: z.number(),
  discount_amount: z.number(),
});

export const bodyAssessmentEntrySchema = z.object({
  id: z.uuid(),
  assessment_date: z.string(),
  weight_kg: nullableNumberSchema,
  height_cm: nullableNumberSchema,
  body_fat_percentage: nullableNumberSchema,
  muscle_mass: nullableNumberSchema,
  waist_cm: nullableNumberSchema,
  chest_cm: nullableNumberSchema,
  arm_cm: nullableNumberSchema,
  hip_cm: nullableNumberSchema,
  arm_right_cm: nullableNumberSchema,
  arm_left_cm: nullableNumberSchema,
  leg_right_cm: nullableNumberSchema,
  leg_left_cm: nullableNumberSchema,
  activity_level: z.string().nullable(),
  diet_type: z.string().nullable(),
  daily_calories: z.number().int().nullable(),
  protein_grams: z.number().int().nullable(),
  carbs_grams: z.number().int().nullable(),
  fat_grams: z.number().int().nullable(),
  water_liters_goal: nullableNumberSchema,
  body_type: z.string().nullable(),
});

export const customerHistoryResponseSchema = z.object({
  profile: customerProfileSchema,
  kpis: customerHistoryKpisSchema,
  access_history: z.array(accessLogEntrySchema),
  payment_history: z.array(paymentEntrySchema),
  subscription_history: z.array(subscriptionEntrySchema),
  body_assessments: z.array(bodyAssessmentEntrySchema),
  heatmap_data: z.record(z.string(), z.number().int().positive()),
});

export type CustomerProfile = z.infer<typeof customerProfileSchema>;
export type CustomerHistoryKPIs = z.infer<typeof customerHistoryKpisSchema>;
export type AccessLogEntry = z.infer<typeof accessLogEntrySchema>;
export type PaymentEntry = z.infer<typeof paymentEntrySchema>;
export type SubscriptionEntry = z.infer<typeof subscriptionEntrySchema>;
export type BodyAssessmentEntry = z.infer<typeof bodyAssessmentEntrySchema>;
export type CustomerHistoryResponse = z.infer<typeof customerHistoryResponseSchema>;
