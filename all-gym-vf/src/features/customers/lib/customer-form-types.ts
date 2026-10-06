import type { ActivityLevel, BodyType, DietType } from "@/lib/fitness/types";
import type { TrainingProfileInput } from "@/lib/training/types";

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

export interface RenewSubscriptionData {
  origin?: "customers" | "cash";
  full_name?: string;
  phone?: string;
  birth_date?: Date;
  gender?: "male" | "female" | "other";
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
