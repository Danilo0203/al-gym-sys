import type { ActivityLevel, BodyType, DietType } from "@/lib/fitness/types";

export type PrimaryGoal = "fat_loss" | "muscle_gain" | "recomp" | "strength" | "general_fitness" | "cardio";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type TrainingLocation = "gym" | "home" | "mixed";
export type CardioPreference = "none" | "light" | "moderate" | "high";
export type TrainingProfileStatus = "pending" | "complete";
export type RoutineStatus = "pending_profile" | "draft" | "active" | "archived";
export type RoutineSource = "system" | "admin";
export type RoutineBlockType = "warmup" | "strength" | "accessory" | "cardio" | "mobility";

export type FocusArea =
  | "upper_body"
  | "lower_body"
  | "glutes"
  | "core"
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "conditioning";

export type EquipmentOption =
  | "full_gym"
  | "body_weight"
  | "dumbbell"
  | "barbell"
  | "machine"
  | "bands"
  | "kettlebell"
  | "treadmill"
  | "bike"
  | "rower";

export type RestrictedMovement =
  | "deep_knee_flexion"
  | "overhead_pressing"
  | "loaded_spinal_flexion"
  | "high_impact"
  | "horizontal_pressing"
  | "vertical_pulling"
  | "hip_hinge"
  | "unilateral_lower_body";

export interface TrainingProfileInput {
  primary_goal?: PrimaryGoal | null;
  secondary_goal?: PrimaryGoal | null;
  focus_areas?: FocusArea[];
  experience_level?: ExperienceLevel | null;
  days_per_week?: number | null;
  session_minutes?: number | null;
  training_location?: TrainingLocation | null;
  equipment_available?: EquipmentOption[];
  activity_level?: ActivityLevel | null;
  cardio_preference?: CardioPreference | null;
  exercise_preferences?: string | null;
  exercise_dislikes?: string | null;
  injuries_or_pain?: string | null;
  restricted_movements?: RestrictedMovement[];
  parq_requires_attention?: boolean | null;
  medical_clearance_notes?: string | null;
}

export interface TrainingProfileRecord extends TrainingProfileInput {
  id: string;
  user_id: string;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface NutritionContext {
  birthDate?: Date | null;
  gender?: "male" | "female" | "other" | null;
  weightKg?: number | null;
  heightCm?: number | null;
  bodyType?: BodyType | null;
  dietType?: DietType | null;
  activityLevel?: ActivityLevel | null;
}

export interface ExerciseCatalogItem {
  id: number;
  slug: string | null;
  name: string;
  display_name: string | null;
  display_name_es: string | null;
  provider: string | null;
  provider_item_id: string | null;
  is_favorite: boolean;
  is_preview_hidden: boolean;
  body_parts: string[];
  target_muscles: string[];
  secondary_muscles: string[];
  equipments: string[];
  exercise_type: string | null;
  instructions: string[];
  tips: string[];
  keywords: string[];
  variations: string[];
  image_url: string | null;
  video_url: string | null;
  description: string | null;
  raw_payload?: unknown;
  last_synced_at?: string | null;
  is_active: boolean;
}

export interface ProviderExerciseSummary {
  exerciseId: string;
  name: string;
  imageUrl: string | null;
}

export interface ExerciseReplacementOption {
  id: number;
  name: string;
  imageUrl: string | null;
  bodyParts: string[];
  targetMuscles: string[];
  equipments: string[];
  reason: string;
  score: number;
}

export interface ExerciseReplacementGroup {
  key: string;
  title: string;
  description?: string;
  options: ExerciseReplacementOption[];
}

export interface RoutineProposalExercise {
  exerciseId: number | null;
  exerciseName: string;
  exerciseOrder: number;
  blockType: RoutineBlockType;
  sets: number | null;
  reps: string | null;
  restSeconds: number | null;
  durationMinutes: number | null;
  targetRir: number | null;
  requiresReview: boolean;
  reason?: string | null;
}

export interface RoutineProposalDay {
  dayIndex: number;
  label: string;
  splitKey: string;
  exercises: RoutineProposalExercise[];
}

export interface RoutineProposal {
  status: RoutineStatus;
  days: RoutineProposalDay[];
  warnings: string[];
  missingRequirements: string[];
  summary: {
    primaryGoal: PrimaryGoal;
    daysPerWeek: number;
    sessionMinutes: number;
    trainingLocation: TrainingLocation;
    cardioPreference: CardioPreference;
  };
}

export interface RoutineDetailRecord {
  id: number;
  routine_id: string;
  day_of_week: number;
  exercise_id: number | null;
  exercise_order: number | null;
  block_type: RoutineBlockType;
  sets: number | null;
  reps: string | null;
  rest_seconds: number | null;
  duration_minutes: number | null;
  target_rir: number | null;
  notes: string | null;
  exercise_name_snapshot: string | null;
  exercise_image_url: string | null;
  exercise_video_url: string | null;
}

export interface RoutineReplacementContext {
  detailId: number;
  routineId: string;
  blockType: RoutineBlockType;
  dayOfWeek: number;
  currentExerciseId: number | null;
  currentExerciseName: string;
  targetMuscles: string[];
  bodyParts: string[];
  equipments: string[];
  keywords: string[];
}

export interface RoutineRecord {
  id: string;
  user_id: string | null;
  created_by: string | null;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
  goal: string | null;
  status: RoutineStatus;
  source: RoutineSource;
  training_profile_id: string | null;
  primary_goal: string | null;
  secondary_goal: string | null;
  generation_version: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at?: string;
}

export interface CustomerRoutineWorkspace {
  trainingProfile: TrainingProfileRecord | null;
  nutritionContext: NutritionContext;
  trainingProfileStatus: TrainingProfileStatus;
  missingRequirements: string[];
  draftRoutine: RoutineRecord | null;
  activeRoutine: RoutineRecord | null;
  pendingRoutine: RoutineRecord | null;
  draftDetails: RoutineDetailRecord[];
  activeDetails: RoutineDetailRecord[];
  pendingDetails: RoutineDetailRecord[];
}
