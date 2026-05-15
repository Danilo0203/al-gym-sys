import type {
  CardioPreference,
  EquipmentOption,
  ExperienceLevel,
  FocusArea,
  PrimaryGoal,
  RestrictedMovement,
  TrainingLocation,
} from "@/lib/training/types";

export const PRIMARY_GOAL_OPTIONS: Array<{ label: string; value: PrimaryGoal }> = [
  { label: "Perder grasa", value: "fat_loss" },
  { label: "Ganar masa muscular", value: "muscle_gain" },
  { label: "Recomposición corporal", value: "recomp" },
  { label: "Fuerza", value: "strength" },
  { label: "Salud general", value: "general_fitness" },
  { label: "Más cardio", value: "cardio" },
];

export const EXPERIENCE_LEVEL_OPTIONS: Array<{ label: string; value: ExperienceLevel }> = [
  { label: "Principiante", value: "beginner" },
  { label: "Intermedio", value: "intermediate" },
  { label: "Avanzado", value: "advanced" },
];

export const TRAINING_LOCATION_OPTIONS: Array<{ label: string; value: TrainingLocation }> = [
  { label: "Gimnasio", value: "gym" },
  { label: "Casa", value: "home" },
  { label: "Mixto", value: "mixed" },
];

export const CARDIO_PREFERENCE_OPTIONS: Array<{ label: string; value: CardioPreference }> = [
  { label: "Nada", value: "none" },
  { label: "Poco", value: "light" },
  { label: "Moderado", value: "moderate" },
  { label: "Alto", value: "high" },
];

export const FOCUS_AREA_OPTIONS: Array<{ label: string; value: FocusArea }> = [
  { label: "Tren superior", value: "upper_body" },
  { label: "Tren inferior", value: "lower_body" },
  { label: "Glúteos", value: "glutes" },
  { label: "Core", value: "core" },
  { label: "Pecho", value: "chest" },
  { label: "Espalda", value: "back" },
  { label: "Hombros", value: "shoulders" },
  { label: "Brazos", value: "arms" },
  { label: "Condicionamiento", value: "conditioning" },
];

export const EQUIPMENT_OPTIONS: Array<{ label: string; value: EquipmentOption }> = [
  { label: "Gimnasio completo", value: "full_gym" },
  { label: "Peso corporal", value: "body_weight" },
  { label: "Mancuernas", value: "dumbbell" },
  { label: "Barra", value: "barbell" },
  { label: "Máquinas", value: "machine" },
  { label: "Bandas", value: "bands" },
  { label: "Kettlebells", value: "kettlebell" },
  { label: "Caminadora", value: "treadmill" },
  { label: "Bicicleta", value: "bike" },
  { label: "Remo", value: "rower" },
];

export const RESTRICTED_MOVEMENT_OPTIONS: Array<{ label: string; value: RestrictedMovement }> = [
  { label: "Flexión profunda de rodilla", value: "deep_knee_flexion" },
  { label: "Press por encima de la cabeza", value: "overhead_pressing" },
  { label: "Flexión de columna con carga", value: "loaded_spinal_flexion" },
  { label: "Impacto alto", value: "high_impact" },
  { label: "Empujes horizontales", value: "horizontal_pressing" },
  { label: "Jalones verticales", value: "vertical_pulling" },
  { label: "Bisagra de cadera", value: "hip_hinge" },
  { label: "Trabajo unilateral de pierna", value: "unilateral_lower_body" },
];

export const DAYS_PER_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((value) => ({
  label: `${value} días`,
  value: value.toString(),
}));

export const SESSION_MINUTES_OPTIONS = [30, 45, 60, 75, 90].map((value) => ({
  label: `${value} min`,
  value: value.toString(),
}));
