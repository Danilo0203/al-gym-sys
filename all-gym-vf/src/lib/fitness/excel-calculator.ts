import type { ActivityLevel, BodyType, DietType, FitnessInputs, FitnessOutputs } from "@/lib/fitness/types";

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  "1_3_dias": 1.375,
  "3_5_dias": 1.55,
  "6_7_dias": 1.725,
  "2_veces_dia": 1.9,
};

const DIET_FACTOR: Record<DietType, number> = {
  hipocalorica: 0.8,
  normocalorica: 1.0,
  hipercalorica: 1.2,
};

const BODY_MACROS: Record<BodyType, { protein: number; carbs: number; fats: number }> = {
  ectomorph: { protein: 0.3, carbs: 0.6, fats: 0.1 },
  mesomorph: { protein: 0.3, carbs: 0.4, fats: 0.3 },
  endomorph: { protein: 0.35, carbs: 0.3, fats: 0.35 },
};

const CARDIO_MINUTES: Record<BodyType, string> = {
  ectomorph: "10-15",
  mesomorph: "15",
  endomorph: "25-30",
};

export function computeAgeFromBirthDate(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

export function computeBmr(weightKg: number, heightCm: number, ageYears: number, gender: "male" | "female" | "other"): number {
  // Excel source uses Mifflin-St Jeor with male/female branches.
  if (gender === "female") {
    return 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
  }
  if (gender === "other") {
    // Neutral fallback for non-binary values while preserving deterministic output.
    return 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 78;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
}

export function applyDietFactor(baseCalories: number, dietType: DietType): number {
  return baseCalories * DIET_FACTOR[dietType];
}

export function applyActivityFactor(baseCalories: number, activityLevel: ActivityLevel): number {
  return baseCalories * ACTIVITY_FACTOR[activityLevel];
}

export function computeMacrosByBodyType(calories: number, bodyType: BodyType) {
  const macros = BODY_MACROS[bodyType];
  const proteinGrams = Math.round((calories * macros.protein) / 4);
  const carbsGrams = Math.round((calories * macros.carbs) / 4);
  const fatGrams = Math.round((calories * macros.fats) / 9);
  return { proteinGrams, carbsGrams, fatGrams };
}

export function computeWaterGoal(weightKg: number): number {
  return Math.round((weightKg / 20) * 10) / 10;
}

export function computeCardioByBodyType(bodyType: BodyType): string {
  return CARDIO_MINUTES[bodyType];
}

export function buildRoutineMode(dietType: DietType): "definicion" | "volumen" {
  return dietType === "hipocalorica" ? "definicion" : "volumen";
}

export function computeFitnessPlan(inputs: FitnessInputs): FitnessOutputs {
  const ageYears = computeAgeFromBirthDate(inputs.birthDate);
  const bmr = computeBmr(inputs.weightKg, inputs.heightCm, ageYears, inputs.gender);
  const caloriesWithActivity = applyActivityFactor(bmr, inputs.activityLevel);
  const dailyCalories = Math.round(applyDietFactor(caloriesWithActivity, inputs.dietType));
  const { proteinGrams, carbsGrams, fatGrams } = computeMacrosByBodyType(dailyCalories, inputs.bodyType);

  return {
    ageYears,
    dailyCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    waterLitersGoal: computeWaterGoal(inputs.weightKg),
    cardioMinutes: computeCardioByBodyType(inputs.bodyType),
    routineMode: buildRoutineMode(inputs.dietType),
    algorithmVersion: "excel_2023_v1",
  };
}
