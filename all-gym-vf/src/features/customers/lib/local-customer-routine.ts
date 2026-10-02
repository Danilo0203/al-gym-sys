import { z } from "zod";
import { isExerciseMediaStoredLocally } from "@/lib/training/exercise-media";
import type { CustomerRoutineWorkspace } from "@/lib/training/types";

const primaryGoalSchema = z.enum([
  "fat_loss",
  "muscle_gain",
  "recomp",
  "strength",
  "general_fitness",
  "cardio",
]);
const focusAreaSchema = z.enum([
  "upper_body",
  "lower_body",
  "glutes",
  "core",
  "chest",
  "back",
  "shoulders",
  "arms",
  "conditioning",
]);
const equipmentSchema = z.enum([
  "full_gym",
  "body_weight",
  "dumbbell",
  "barbell",
  "machine",
  "bands",
  "kettlebell",
  "treadmill",
  "bike",
  "rower",
]);
const restrictedMovementSchema = z.enum([
  "deep_knee_flexion",
  "overhead_pressing",
  "loaded_spinal_flexion",
  "high_impact",
  "horizontal_pressing",
  "vertical_pulling",
  "hip_hinge",
  "unilateral_lower_body",
]);
const activityLevelSchema = z.enum([
  "sedentario",
  "1_3_dias",
  "3_5_dias",
  "6_7_dias",
  "2_veces_dia",
]);

const trainingProfileSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  primary_goal: primaryGoalSchema.nullable(),
  secondary_goal: primaryGoalSchema.nullable(),
  focus_areas: z.array(focusAreaSchema),
  experience_level: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
  days_per_week: z.number().int().nullable(),
  session_minutes: z.number().int().nullable(),
  training_location: z.enum(["gym", "home", "mixed"]).nullable(),
  equipment_available: z.array(equipmentSchema),
  activity_level: activityLevelSchema.nullable(),
  cardio_preference: z.enum(["none", "light", "moderate", "high"]).nullable(),
  exercise_preferences: z.string().nullable(),
  exercise_dislikes: z.string().nullable(),
  injuries_or_pain: z.string().nullable(),
  restricted_movements: z.array(restrictedMovementSchema),
  parq_requires_attention: z.boolean().nullable(),
  medical_clearance_notes: z.string().nullable(),
  is_complete: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const nutritionContextSchema = z.object({
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : null)),
  gender: z.enum(["male", "female", "other"]).nullable(),
  weightKg: z.number().nullable(),
  heightCm: z.number().nullable(),
  bodyType: z.enum(["ectomorph", "mesomorph", "endomorph"]).nullable(),
  dietType: z.enum(["hipocalorica", "normocalorica", "hipercalorica"]).nullable(),
  activityLevel: activityLevelSchema.nullable(),
});

export const routineSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid().nullable(),
  created_by: z.uuid().nullable(),
  name: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  is_active: z.boolean().nullable(),
  goal: z.string().nullable(),
  status: z.enum(["pending_profile", "draft", "active", "archived"]),
  source: z.enum(["system", "admin"]),
  training_profile_id: z.uuid().nullable(),
  primary_goal: z.string().nullable(),
  secondary_goal: z.string().nullable(),
  generation_version: z.string().nullable(),
  reviewed_by: z.uuid().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string().optional(),
});

export const routineDetailSchema = z.object({
  id: z.number().int(),
  routine_id: z.uuid(),
  day_of_week: z.number().int(),
  exercise_id: z.number().int().nullable(),
  exercise_order: z.number().int().nullable(),
  block_type: z.enum(["warmup", "strength", "accessory", "cardio", "mobility"]),
  sets: z.number().int().nullable(),
  reps: z.string().nullable(),
  rest_seconds: z.number().int().nullable(),
  duration_minutes: z.number().int().nullable(),
  target_rir: z.number().nullable(),
  notes: z.string().nullable(),
  exercise_name_snapshot: z.string().nullable(),
  exercise_image_url: z.string().nullable(),
  exercise_video_url: z.string().nullable(),
}).transform((detail) => ({
  ...detail,
  exercise_image_url: isExerciseMediaStoredLocally(detail.exercise_image_url)
    ? detail.exercise_image_url : null,
  exercise_video_url: null,
}));

export const customerRoutineWorkspaceSchema = z.object({
  trainingProfile: trainingProfileSchema.nullable(),
  nutritionContext: nutritionContextSchema,
  trainingProfileStatus: z.enum(["pending", "complete"]),
  missingRequirements: z.array(z.string()),
  draftRoutine: routineSchema.nullable(),
  activeRoutine: routineSchema.nullable(),
  pendingRoutine: routineSchema.nullable(),
  draftDetails: z.array(routineDetailSchema),
  activeDetails: z.array(routineDetailSchema),
  pendingDetails: z.array(routineDetailSchema),
});

const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableTextSchema = (maximum: number) => z.string().trim().max(maximum).nullable();
const routineStatusSchema = z.enum(["pending_profile", "draft", "active", "archived"]);
const routineSourceSchema = z.enum(["system", "admin"]);
const routineBlockTypeSchema = z.enum(["warmup", "strength", "accessory", "cardio", "mobility"]);

const routineWriteShape = {
  name: z.string().trim().min(1).max(160),
  start_date: calendarDateSchema,
  end_date: calendarDateSchema.nullable(),
  goal: nullableTextSchema(500),
  status: routineStatusSchema,
  source: routineSourceSchema,
  training_profile_id: z.uuid().nullable(),
  primary_goal: nullableTextSchema(80),
  secondary_goal: nullableTextSchema(80),
  generation_version: nullableTextSchema(120),
};

export const createCustomerRoutineInputSchema = z.object({
  name: routineWriteShape.name,
  start_date: routineWriteShape.start_date.optional(),
  end_date: routineWriteShape.end_date.optional(),
  goal: routineWriteShape.goal.optional(),
  status: routineWriteShape.status.optional(),
  source: routineWriteShape.source.optional(),
  training_profile_id: routineWriteShape.training_profile_id.optional(),
  primary_goal: routineWriteShape.primary_goal.optional(),
  secondary_goal: routineWriteShape.secondary_goal.optional(),
  generation_version: routineWriteShape.generation_version.optional(),
}).strict();

export const updateCustomerRoutineInputSchema = z.object(routineWriteShape)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Debe enviar al menos un campo");

const detailWriteShape = {
  day_of_week: z.number().int().min(1).max(7),
  exercise_id: z.number().int().positive().nullable(),
  exercise_order: z.number().int().positive().nullable(),
  block_type: routineBlockTypeSchema,
  sets: z.number().int().positive().nullable(),
  reps: nullableTextSchema(80),
  rest_seconds: z.number().int().nonnegative().nullable(),
  duration_minutes: z.number().int().nonnegative().nullable(),
  target_rir: z.number().min(0).max(10).nullable(),
  notes: nullableTextSchema(2000),
  exercise_name_snapshot: nullableTextSchema(240),
};

export const createRoutineDetailInputSchema = z.object({
  day_of_week: detailWriteShape.day_of_week,
  exercise_id: detailWriteShape.exercise_id.optional(),
  exercise_order: detailWriteShape.exercise_order.optional(),
  block_type: detailWriteShape.block_type.optional(),
  sets: detailWriteShape.sets.optional(),
  reps: detailWriteShape.reps.optional(),
  rest_seconds: detailWriteShape.rest_seconds.optional(),
  duration_minutes: detailWriteShape.duration_minutes.optional(),
  target_rir: detailWriteShape.target_rir.optional(),
  notes: detailWriteShape.notes.optional(),
  exercise_name_snapshot: detailWriteShape.exercise_name_snapshot.optional(),
}).strict();

export const updateRoutineDetailInputSchema = z.object(detailWriteShape)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Debe enviar al menos un campo");

export const customerRoutineMutationResponseSchema = z.object({
  customer_id: z.uuid(),
  routine: routineSchema,
});

export const routineDetailMutationResponseSchema = z.object({
  customer_id: z.uuid(),
  routine_id: z.uuid(),
  detail: routineDetailSchema,
});

export type CreateCustomerRoutineInput = z.infer<typeof createCustomerRoutineInputSchema>;
export type UpdateCustomerRoutineInput = z.infer<typeof updateCustomerRoutineInputSchema>;
export type CreateRoutineDetailInput = z.infer<typeof createRoutineDetailInputSchema>;
export type UpdateRoutineDetailInput = z.infer<typeof updateRoutineDetailInputSchema>;
export type CustomerRoutineMutationResponse = z.infer<typeof customerRoutineMutationResponseSchema>;
export type RoutineDetailMutationResponse = z.infer<typeof routineDetailMutationResponseSchema>;

export function parseCustomerRoutineWorkspace(payload: unknown): CustomerRoutineWorkspace {
  return customerRoutineWorkspaceSchema.parse(payload);
}
