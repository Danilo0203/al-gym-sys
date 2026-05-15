export type BodyType = "ectomorph" | "mesomorph" | "endomorph";
export type DietType = "hipocalorica" | "normocalorica" | "hipercalorica";
export type ActivityLevel = "sedentario" | "1_3_dias" | "3_5_dias" | "6_7_dias" | "2_veces_dia";

export interface FitnessInputs {
  birthDate: Date;
  gender: "male" | "female" | "other";
  weightKg: number;
  heightCm: number;
  bodyType: BodyType;
  dietType: DietType;
  activityLevel: ActivityLevel;
}

export interface FitnessOutputs {
  ageYears: number;
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  waterLitersGoal: number;
  cardioMinutes: string;
  routineMode: "definicion" | "volumen";
  algorithmVersion: "excel_2023_v1";
}
