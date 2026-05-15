import { getMissingTrainingProfileRequirements, normalizeTrainingProfileInput } from "@/lib/training/profile";
import { getExerciseDisplayName, isExerciseCompatibleForProfile, scoreExerciseForIntent } from "@/lib/training/exercise-recommendations";
import type {
  CardioPreference,
  ExerciseCatalogItem,
  PrimaryGoal,
  RoutineBlockType,
  RoutineProposal,
  RoutineProposalDay,
  RoutineProposalExercise,
  TrainingProfileInput,
} from "@/lib/training/types";
import type { NutritionContext } from "@/lib/training/types";

export const ROUTINE_ENGINE_VERSION = "routine_engine_v1";

interface ExerciseSlot {
  key: string;
  label: string;
  blockType: RoutineBlockType;
  targetMuscles?: string[];
  bodyParts?: string[];
  exerciseTypes?: string[];
  keywords?: string[];
}

interface DayTemplate {
  label: string;
  splitKey: string;
  slots: ExerciseSlot[];
}

const DAY_TEMPLATES: Record<number, DayTemplate[]> = {
  2: [
    {
      label: "Full Body A",
      splitKey: "full_body_a",
      slots: [
        { key: "warmup", label: "Calentamiento general", blockType: "warmup" },
        { key: "squat", label: "Dominante de rodilla", blockType: "strength", targetMuscles: ["quadriceps"], bodyParts: ["lower legs"], keywords: ["squat", "press"] },
        { key: "push", label: "Empuje horizontal", blockType: "strength", targetMuscles: ["pectorals"], bodyParts: ["chest"], keywords: ["press", "push"] },
        { key: "pull", label: "Jalón horizontal", blockType: "strength", targetMuscles: ["lats", "mid back"], bodyParts: ["back"], keywords: ["row"] },
        { key: "hinge", label: "Bisagra de cadera", blockType: "accessory", targetMuscles: ["hamstrings", "glutes"], bodyParts: ["upper legs"], keywords: ["deadlift", "bridge", "thrust"] },
        { key: "core", label: "Core", blockType: "accessory", targetMuscles: ["core"], bodyParts: ["waist"], keywords: ["plank", "dead bug"] },
      ],
    },
    {
      label: "Full Body B",
      splitKey: "full_body_b",
      slots: [
        { key: "warmup", label: "Calentamiento general", blockType: "warmup" },
        { key: "hinge", label: "Cadena posterior", blockType: "strength", targetMuscles: ["glutes", "hamstrings"], bodyParts: ["upper legs"], keywords: ["thrust", "deadlift", "bridge"] },
        { key: "vertical_push", label: "Empuje vertical", blockType: "strength", targetMuscles: ["delts"], bodyParts: ["shoulders"], keywords: ["press"] },
        { key: "vertical_pull", label: "Jalón vertical", blockType: "strength", targetMuscles: ["lats"], bodyParts: ["back"], keywords: ["pull", "pulldown"] },
        { key: "single_leg", label: "Trabajo unilateral", blockType: "accessory", targetMuscles: ["quadriceps", "glutes"], bodyParts: ["upper legs"], keywords: ["lunge", "split squat"] },
        { key: "core", label: "Core", blockType: "accessory", targetMuscles: ["core"], bodyParts: ["waist"], keywords: ["plank", "dead bug"] },
      ],
    },
  ],
  3: [
    {
      label: "Full Body A",
      splitKey: "full_body_a",
      slots: [
        { key: "warmup", label: "Calentamiento general", blockType: "warmup" },
        { key: "squat", label: "Dominante de rodilla", blockType: "strength", targetMuscles: ["quadriceps"], bodyParts: ["lower legs"], keywords: ["squat", "press"] },
        { key: "push", label: "Empuje horizontal", blockType: "strength", targetMuscles: ["pectorals"], bodyParts: ["chest"], keywords: ["press", "push"] },
        { key: "pull", label: "Jalón horizontal", blockType: "strength", targetMuscles: ["lats", "mid back"], bodyParts: ["back"], keywords: ["row"] },
        { key: "core", label: "Core", blockType: "accessory", targetMuscles: ["core"], bodyParts: ["waist"], keywords: ["plank", "dead bug"] },
      ],
    },
    {
      label: "Full Body B",
      splitKey: "full_body_b",
      slots: [
        { key: "warmup", label: "Calentamiento general", blockType: "warmup" },
        { key: "hinge", label: "Cadena posterior", blockType: "strength", targetMuscles: ["glutes", "hamstrings"], bodyParts: ["upper legs"], keywords: ["thrust", "deadlift", "bridge"] },
        { key: "vertical_push", label: "Empuje vertical", blockType: "strength", targetMuscles: ["delts"], bodyParts: ["shoulders"], keywords: ["press"] },
        { key: "vertical_pull", label: "Jalón vertical", blockType: "strength", targetMuscles: ["lats"], bodyParts: ["back"], keywords: ["pull", "pulldown"] },
        { key: "arms", label: "Brazos", blockType: "accessory", targetMuscles: ["biceps", "triceps"], bodyParts: ["upper arms"], keywords: ["curl", "triceps"] },
      ],
    },
    {
      label: "Full Body C",
      splitKey: "full_body_c",
      slots: [
        { key: "warmup", label: "Calentamiento general", blockType: "warmup" },
        { key: "single_leg", label: "Trabajo unilateral", blockType: "strength", targetMuscles: ["quadriceps", "glutes"], bodyParts: ["upper legs"], keywords: ["lunge", "split squat"] },
        { key: "push", label: "Empuje superior", blockType: "strength", targetMuscles: ["pectorals", "delts"], bodyParts: ["chest", "shoulders"], keywords: ["press", "push"] },
        { key: "pull", label: "Jalón superior", blockType: "strength", targetMuscles: ["lats", "mid back"], bodyParts: ["back"], keywords: ["row", "pull"] },
        { key: "glutes", label: "Glúteos y core", blockType: "accessory", targetMuscles: ["glutes", "core"], bodyParts: ["upper legs", "waist"], keywords: ["bridge", "thrust", "plank"] },
      ],
    },
  ],
  4: [
    {
      label: "Upper A",
      splitKey: "upper_a",
      slots: [
        { key: "warmup", label: "Calentamiento superior", blockType: "warmup" },
        { key: "push", label: "Pecho", blockType: "strength", targetMuscles: ["pectorals"], bodyParts: ["chest"], keywords: ["press", "push"] },
        { key: "pull", label: "Espalda", blockType: "strength", targetMuscles: ["lats", "mid back"], bodyParts: ["back"], keywords: ["row", "pull"] },
        { key: "shoulders", label: "Hombros", blockType: "accessory", targetMuscles: ["delts"], bodyParts: ["shoulders"], keywords: ["raise", "press"] },
        { key: "arms", label: "Brazos", blockType: "accessory", targetMuscles: ["biceps", "triceps"], bodyParts: ["upper arms"], keywords: ["curl", "triceps"] },
      ],
    },
    {
      label: "Lower A",
      splitKey: "lower_a",
      slots: [
        { key: "warmup", label: "Calentamiento inferior", blockType: "warmup" },
        { key: "squat", label: "Dominante de rodilla", blockType: "strength", targetMuscles: ["quadriceps"], bodyParts: ["lower legs"], keywords: ["squat", "press"] },
        { key: "hinge", label: "Cadena posterior", blockType: "strength", targetMuscles: ["hamstrings", "glutes"], bodyParts: ["upper legs"], keywords: ["deadlift", "thrust", "bridge"] },
        { key: "single_leg", label: "Trabajo unilateral", blockType: "accessory", targetMuscles: ["quadriceps", "glutes"], bodyParts: ["upper legs"], keywords: ["lunge", "split squat"] },
        { key: "core", label: "Core", blockType: "accessory", targetMuscles: ["core"], bodyParts: ["waist"], keywords: ["plank", "dead bug"] },
      ],
    },
    {
      label: "Upper B",
      splitKey: "upper_b",
      slots: [
        { key: "warmup", label: "Calentamiento superior", blockType: "warmup" },
        { key: "vertical_push", label: "Press vertical", blockType: "strength", targetMuscles: ["delts"], bodyParts: ["shoulders"], keywords: ["press"] },
        { key: "vertical_pull", label: "Jalón vertical", blockType: "strength", targetMuscles: ["lats"], bodyParts: ["back"], keywords: ["pull", "pulldown"] },
        { key: "horizontal_push", label: "Pecho", blockType: "accessory", targetMuscles: ["pectorals"], bodyParts: ["chest"], keywords: ["press", "push"] },
        { key: "arms", label: "Brazos", blockType: "accessory", targetMuscles: ["biceps", "triceps"], bodyParts: ["upper arms"], keywords: ["curl", "triceps"] },
      ],
    },
    {
      label: "Lower B",
      splitKey: "lower_b",
      slots: [
        { key: "warmup", label: "Calentamiento inferior", blockType: "warmup" },
        { key: "glutes", label: "Glúteos", blockType: "strength", targetMuscles: ["glutes"], bodyParts: ["upper legs"], keywords: ["thrust", "bridge"] },
        { key: "squat", label: "Pierna", blockType: "strength", targetMuscles: ["quadriceps"], bodyParts: ["lower legs"], keywords: ["squat", "press"] },
        { key: "hinge", label: "Cadena posterior", blockType: "accessory", targetMuscles: ["hamstrings"], bodyParts: ["upper legs"], keywords: ["deadlift", "bridge"] },
        { key: "core", label: "Core", blockType: "accessory", targetMuscles: ["core"], bodyParts: ["waist"], keywords: ["plank", "dead bug"] },
      ],
    },
  ],
  5: [
    {
      label: "Push",
      splitKey: "push",
      slots: [
        { key: "warmup", label: "Calentamiento superior", blockType: "warmup" },
        { key: "push", label: "Pecho", blockType: "strength", targetMuscles: ["pectorals"], bodyParts: ["chest"], keywords: ["press", "push"] },
        { key: "vertical_push", label: "Hombros", blockType: "strength", targetMuscles: ["delts"], bodyParts: ["shoulders"], keywords: ["press"] },
        { key: "triceps", label: "Tríceps", blockType: "accessory", targetMuscles: ["triceps"], bodyParts: ["upper arms"], keywords: ["triceps"] },
      ],
    },
    {
      label: "Pull",
      splitKey: "pull",
      slots: [
        { key: "warmup", label: "Calentamiento superior", blockType: "warmup" },
        { key: "vertical_pull", label: "Jalón vertical", blockType: "strength", targetMuscles: ["lats"], bodyParts: ["back"], keywords: ["pull", "pulldown"] },
        { key: "horizontal_pull", label: "Remo", blockType: "strength", targetMuscles: ["mid back", "lats"], bodyParts: ["back"], keywords: ["row"] },
        { key: "biceps", label: "Bíceps", blockType: "accessory", targetMuscles: ["biceps"], bodyParts: ["upper arms"], keywords: ["curl"] },
      ],
    },
    {
      label: "Legs",
      splitKey: "legs",
      slots: [
        { key: "warmup", label: "Calentamiento inferior", blockType: "warmup" },
        { key: "squat", label: "Pierna", blockType: "strength", targetMuscles: ["quadriceps"], bodyParts: ["lower legs"], keywords: ["squat", "press"] },
        { key: "hinge", label: "Cadena posterior", blockType: "strength", targetMuscles: ["hamstrings", "glutes"], bodyParts: ["upper legs"], keywords: ["deadlift", "thrust", "bridge"] },
        { key: "single_leg", label: "Unilateral", blockType: "accessory", targetMuscles: ["glutes", "quadriceps"], bodyParts: ["upper legs"], keywords: ["lunge", "split squat"] },
        { key: "core", label: "Core", blockType: "accessory", targetMuscles: ["core"], bodyParts: ["waist"], keywords: ["plank", "dead bug"] },
      ],
    },
    {
      label: "Upper",
      splitKey: "upper",
      slots: [
        { key: "warmup", label: "Calentamiento superior", blockType: "warmup" },
        { key: "push", label: "Empuje superior", blockType: "strength", targetMuscles: ["pectorals", "delts"], bodyParts: ["chest", "shoulders"], keywords: ["press", "push"] },
        { key: "pull", label: "Jalón superior", blockType: "strength", targetMuscles: ["lats", "mid back"], bodyParts: ["back"], keywords: ["row", "pull"] },
        { key: "shoulders", label: "Hombro", blockType: "accessory", targetMuscles: ["delts"], bodyParts: ["shoulders"], keywords: ["raise", "press"] },
        { key: "arms", label: "Brazos", blockType: "accessory", targetMuscles: ["biceps", "triceps"], bodyParts: ["upper arms"], keywords: ["curl", "triceps"] },
      ],
    },
    {
      label: "Lower",
      splitKey: "lower",
      slots: [
        { key: "warmup", label: "Calentamiento inferior", blockType: "warmup" },
        { key: "glutes", label: "Glúteos", blockType: "strength", targetMuscles: ["glutes"], bodyParts: ["upper legs"], keywords: ["thrust", "bridge"] },
        { key: "squat", label: "Pierna", blockType: "strength", targetMuscles: ["quadriceps"], bodyParts: ["lower legs"], keywords: ["squat", "press"] },
        { key: "hinge", label: "Posterior", blockType: "accessory", targetMuscles: ["hamstrings"], bodyParts: ["upper legs"], keywords: ["deadlift", "bridge"] },
        { key: "core", label: "Core", blockType: "accessory", targetMuscles: ["core"], bodyParts: ["waist"], keywords: ["plank", "dead bug"] },
      ],
    },
  ],
};

function getCardioMinutes(goal: PrimaryGoal, preference: CardioPreference, sessionMinutes: number) {
  if (preference === "none") return 0;

  const baseByPreference: Record<CardioPreference, number> = {
    none: 0,
    light: 8,
    moderate: 12,
    high: 18,
  };

  const goalBonus = goal === "cardio" ? 8 : goal === "fat_loss" ? 4 : 0;
  const sessionCap = sessionMinutes >= 75 ? 20 : sessionMinutes >= 60 ? 15 : 10;

  return Math.min(baseByPreference[preference] + goalBonus, sessionCap);
}

function getPrescription(goal: PrimaryGoal, blockType: RoutineBlockType) {
  if (blockType === "warmup") {
    return { sets: null, reps: null, restSeconds: null, durationMinutes: 6, targetRir: null };
  }

  if (blockType === "cardio") {
    return { sets: null, reps: null, restSeconds: null, durationMinutes: 12, targetRir: null };
  }

  if (blockType === "mobility") {
    return { sets: null, reps: null, restSeconds: null, durationMinutes: 5, targetRir: null };
  }

  if (goal === "strength") {
    return {
      sets: blockType === "strength" ? 4 : 3,
      reps: blockType === "strength" ? "4-6" : "8-10",
      restSeconds: blockType === "strength" ? 150 : 75,
      durationMinutes: null,
      targetRir: blockType === "strength" ? 2 : 3,
    };
  }

  if (goal === "muscle_gain") {
    return {
      sets: blockType === "strength" ? 4 : 3,
      reps: blockType === "strength" ? "6-10" : "10-15",
      restSeconds: blockType === "strength" ? 90 : 60,
      durationMinutes: null,
      targetRir: 2,
    };
  }

  return {
    sets: blockType === "strength" ? 3 : 2,
    reps: blockType === "strength" ? "8-12" : "12-15",
    restSeconds: blockType === "strength" ? 75 : 45,
    durationMinutes: null,
    targetRir: 3,
  };
}

function buildPlaceholderExercise(slot: ExerciseSlot, goal: PrimaryGoal, order: number, reason: string): RoutineProposalExercise {
  const prescription = getPrescription(goal, slot.blockType);
  return {
    exerciseId: null,
    exerciseName: `${slot.label} pendiente`,
    exerciseOrder: order,
    blockType: slot.blockType,
    sets: prescription.sets,
    reps: prescription.reps,
    restSeconds: prescription.restSeconds,
    durationMinutes: prescription.durationMinutes,
    targetRir: prescription.targetRir,
    requiresReview: true,
    reason,
  };
}

function buildWarmupExercise(order: number): RoutineProposalExercise {
  return {
    exerciseId: null,
    exerciseName: "Movilidad dinámica y activación",
    exerciseOrder: order,
    blockType: "warmup",
    sets: null,
    reps: null,
    restSeconds: null,
    durationMinutes: 6,
    targetRir: null,
    requiresReview: false,
    reason: null,
  };
}

function selectExerciseForSlot(
  exercises: ExerciseCatalogItem[],
  slot: ExerciseSlot,
  profile: ReturnType<typeof normalizeTrainingProfileInput>,
  usedExerciseIds: Set<number>,
) {
  const candidates = exercises
    .filter((exercise) => isExerciseCompatibleForProfile(exercise, profile))
    .filter((exercise) => !usedExerciseIds.has(exercise.id))
    .map((exercise) => ({ exercise, score: scoreExerciseForIntent(exercise, slot, profile) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return getExerciseDisplayName(left.exercise).localeCompare(getExerciseDisplayName(right.exercise), "es");
    });

  return candidates[0]?.exercise ?? null;
}

function pruneSlotsForSession(day: DayTemplate, sessionMinutes: number) {
  if (sessionMinutes >= 60) return day.slots;
  if (sessionMinutes >= 45) return day.slots.filter((slot, index) => index < 5);
  return day.slots.filter((slot) => ["warmup", "squat", "push", "pull", "hinge", "vertical_pull", "vertical_push"].includes(slot.key));
}

function buildDay(
  day: DayTemplate,
  dayIndex: number,
  goal: PrimaryGoal,
  sessionMinutes: number,
  cardioMinutes: number,
  exercises: ExerciseCatalogItem[],
  profile: ReturnType<typeof normalizeTrainingProfileInput>,
  usedExerciseIds: Set<number>,
) {
  const proposalExercises: RoutineProposalExercise[] = [];
  const slots = pruneSlotsForSession(day, sessionMinutes);

  slots.forEach((slot, index) => {
    const order = index + 1;
    if (slot.blockType === "warmup") {
      proposalExercises.push(buildWarmupExercise(order));
      return;
    }

    const selectedExercise = selectExerciseForSlot(exercises, slot, profile, usedExerciseIds);
    if (!selectedExercise) {
      proposalExercises.push(buildPlaceholderExercise(slot, goal, order, "No hay ejercicio compatible en el catálogo local."));
      return;
    }

    usedExerciseIds.add(selectedExercise.id);
    const prescription = getPrescription(goal, slot.blockType);
      proposalExercises.push({
        exerciseId: selectedExercise.id,
        exerciseName: getExerciseDisplayName(selectedExercise),
        exerciseOrder: order,
        blockType: slot.blockType,
      sets: prescription.sets,
      reps: prescription.reps,
      restSeconds: prescription.restSeconds,
      durationMinutes: prescription.durationMinutes,
      targetRir: prescription.targetRir,
      requiresReview: false,
      reason: null,
    });
  });

  if (cardioMinutes > 0 && (goal === "fat_loss" || goal === "cardio")) {
    proposalExercises.push({
      exerciseId: null,
      exerciseName: "Cardio final",
      exerciseOrder: proposalExercises.length + 1,
      blockType: "cardio",
      sets: null,
      reps: null,
      restSeconds: null,
      durationMinutes: cardioMinutes,
      targetRir: null,
      requiresReview: false,
      reason: null,
    });
  }

  return {
    dayIndex,
    label: day.label,
    splitKey: day.splitKey,
    exercises: proposalExercises,
  } satisfies RoutineProposalDay;
}

export function buildRoutineProposal(params: {
  trainingProfile: TrainingProfileInput;
  nutritionContext?: NutritionContext;
  exercises: ExerciseCatalogItem[];
}): RoutineProposal {
  const normalizedProfile = normalizeTrainingProfileInput(params.trainingProfile);
  const missingRequirements = getMissingTrainingProfileRequirements(normalizedProfile, params.nutritionContext);

  const primaryGoal = normalizedProfile.primary_goal || "general_fitness";
  const daysPerWeek = normalizedProfile.days_per_week || 3;
  const sessionMinutes = normalizedProfile.session_minutes || 45;
  const trainingLocation = normalizedProfile.training_location || "gym";
  const cardioPreference = normalizedProfile.cardio_preference || "light";
  const warnings: string[] = [];

  if (normalizedProfile.parq_requires_attention) {
    warnings.push("El cliente marcó observaciones en el screening PAR-Q. Revisa autorización médica antes de progresar la carga.");
  }

  if (normalizedProfile.injuries_or_pain) {
    warnings.push(`Dolor o lesión reportada: ${normalizedProfile.injuries_or_pain}.`);
  }

  if (missingRequirements.length > 0) {
    return {
      status: "pending_profile",
      days: [],
      warnings,
      missingRequirements,
      summary: {
        primaryGoal,
        daysPerWeek,
        sessionMinutes,
        trainingLocation,
        cardioPreference,
      },
    };
  }

  const templates = DAY_TEMPLATES[daysPerWeek] || DAY_TEMPLATES[3];
  const cardioMinutes = getCardioMinutes(primaryGoal, cardioPreference, sessionMinutes);
  const usedExerciseIds = new Set<number>();
  const days = templates.map((day, index) =>
    buildDay(day, index + 1, primaryGoal, sessionMinutes, cardioMinutes, params.exercises, normalizedProfile, usedExerciseIds),
  );

  if (days.some((day) => day.exercises.some((exercise) => exercise.requiresReview))) {
    warnings.push("Algunos espacios quedaron pendientes porque el catálogo local no tiene ejercicios compatibles suficientes.");
  }

  if (params.exercises.length === 0) {
    warnings.push("El catálogo local está vacío. Importa ejercicios o sincroniza ExerciseDB para mejorar la propuesta.");
  }

  return {
    status: "draft",
    days,
    warnings,
    missingRequirements: [],
    summary: {
      primaryGoal,
      daysPerWeek,
      sessionMinutes,
      trainingLocation,
      cardioPreference,
    },
  };
}
