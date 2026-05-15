import { normalizeTextArray, normalizeTrainingProfileInput } from "@/lib/training/profile";
import type {
  EquipmentOption,
  ExerciseCatalogItem,
  ExerciseReplacementGroup,
  ExerciseReplacementOption,
  FocusArea,
  RestrictedMovement,
  RoutineBlockType,
  RoutineDetailRecord,
  RoutineReplacementContext,
  TrainingProfileInput,
} from "@/lib/training/types";

export interface ExerciseSelectionIntent {
  blockType: RoutineBlockType;
  label?: string;
  targetMuscles?: string[];
  bodyParts?: string[];
  equipments?: string[];
  exerciseTypes?: string[];
  keywords?: string[];
}

const EXERCISE_SEARCH_STOPWORDS = new Set(["con", "de", "del", "la", "el", "los", "las", "para", "en", "y", "a", "al"]);
const EXERCISE_SEARCH_PHRASES: Array<[string, string[]]> = [
  ["sentadilla con peso corporal", ["bodyweight squat", "squat"]],
  ["prensa de pierna", ["leg press", "sled leg press"]],
  ["peso corporal", ["bodyweight", "body weight"]],
  ["press inclinado", ["incline press"]],
  ["press de banca", ["bench press"]],
  ["press militar", ["shoulder press", "military press"]],
  ["peso muerto rumano", ["romanian deadlift", "rdl"]],
  ["peso muerto", ["deadlift"]],
  ["remo con mancuerna", ["dumbbell row", "one arm row"]],
  ["jalon", ["pulldown", "lat pulldown"]],
  ["jalon de triceps", ["triceps pushdown", "triceps pulldown"]],
  ["dominada", ["pull up", "pull-up"]],
  ["elevacion de talones", ["calf raise", "standing calf raise"]],
  ["curl femoral", ["leg curl", "hamstring curl"]],
  ["extension de cuadriceps", ["leg extension", "quadriceps extension"]],
  ["apertura de pecho", ["chest fly", "pec fly"]],
  ["fondos", ["dip", "dips"]],
  ["intervalos en bicicleta", ["bike intervals", "cycling"]],
  ["movilidad dinamica y activacion", ["dynamic warmup", "mobility activation"]],
  ["zancada", ["lunge"]],
  ["remo", ["row"]],
  ["elevacion lateral", ["lateral raise"]],
  ["elevacion frontal", ["front raise"]],
  ["curl de biceps", ["biceps curl", "curl"]],
  ["extension de triceps", ["triceps extension", "triceps"]],
];
const EXERCISE_SEARCH_TOKEN_MAP: Record<string, string[]> = {
  sentadilla: ["squat"],
  goblet: ["goblet"],
  barra: ["barbell"],
  mancuerna: ["dumbbell"],
  mancuernas: ["dumbbell"],
  prensa: ["press"],
  peso: ["weight"],
  corporal: ["bodyweight"],
  puente: ["bridge"],
  bici: ["bike", "cycling"],
  bicicleta: ["bike", "cycling"],
  ciclismo: ["cycling"],
  intervalos: ["intervals"],
  dinamica: ["dynamic"],
  jalon: ["pulldown"],
  triceps: ["triceps"],
  biceps: ["biceps"],
  press: ["press"],
  inclinado: ["incline"],
  plano: ["flat"],
  declinado: ["decline"],
  remo: ["row"],
  zancada: ["lunge"],
  dominada: ["pull up"],
  dominadas: ["pull up"],
  lagartija: ["push up"],
  flexion: ["push up"],
  flexiones: ["push up"],
  plancha: ["plank"],
  elevacion: ["raise"],
  elevaciones: ["raise"],
  lateral: ["lateral"],
  frontal: ["front"],
  pecho: ["chest", "pectorals"],
  pectoral: ["chest", "pectorals"],
  pectorales: ["chest", "pectorals"],
  espalda: ["back", "lats"],
  hombro: ["shoulder", "shoulders"],
  hombros: ["shoulder", "shoulders"],
  pierna: ["leg", "upper legs", "lower legs"],
  piernas: ["legs", "upper legs", "lower legs"],
  gluteo: ["glute", "glutes"],
  gluteos: ["glute", "glutes"],
  cuadriceps: ["quads"],
  cuadricep: ["quads"],
  femoral: ["hamstrings"],
  femorales: ["hamstrings"],
  abdominal: ["abs"],
  abdominales: ["abs"],
  abdomen: ["abs"],
  pantorrilla: ["calf", "calves"],
  pantorrillas: ["calf", "calves"],
  gemelo: ["calf", "calves"],
  gemelos: ["calf", "calves"],
  isquiotibial: ["hamstrings"],
  isquiotibiales: ["hamstrings"],
  aductor: ["adductors"],
  aductores: ["adductors"],
  abductor: ["abductors"],
  abductores: ["abductors"],
  antebrazo: ["forearms"],
  antebrazos: ["forearms"],
  lumbar: ["lower back"],
  lumbares: ["lower back"],
  movilidad: ["mobility"],
  activacion: ["activation"],
  calentamiento: ["warmup"],
};

const RESTRICTION_MATCHERS: Record<RestrictedMovement, string[]> = {
  deep_knee_flexion: ["squat", "press", "lunge", "split squat"],
  overhead_pressing: ["overhead", "shoulder press", "military press"],
  loaded_spinal_flexion: ["crunch", "sit up", "good morning"],
  high_impact: ["jump", "plyo", "high impact"],
  horizontal_pressing: ["push-up", "bench", "chest press", "incline"],
  vertical_pulling: ["pull-up", "pulldown", "chin up"],
  hip_hinge: ["deadlift", "thrust", "bridge", "hinge"],
  unilateral_lower_body: ["lunge", "split squat", "step up"],
};

const FOCUS_AREA_MATCHERS: Record<FocusArea, string[]> = {
  upper_body: ["chest", "shoulders", "back", "upper arms"],
  lower_body: ["lower legs", "upper legs", "quadriceps", "hamstrings"],
  glutes: ["glutes"],
  core: ["core", "waist"],
  chest: ["chest", "pectorals"],
  back: ["back", "lats", "mid back"],
  shoulders: ["shoulders", "delts"],
  arms: ["upper arms", "biceps", "triceps"],
  conditioning: ["cardio", "conditioning"],
};

const COMPLEXITY_KEYWORDS = ["barbell", "pull-up", "romanian deadlift", "jump rope"];

const BLOCK_FALLBACKS: Record<
  RoutineBlockType,
  {
    label: string;
    targetMuscles: string[];
    bodyParts: string[];
    keywords: string[];
    exerciseTypes: string[];
  }
> = {
  warmup: {
    label: "Calentamiento",
    targetMuscles: ["core", "glutes"],
    bodyParts: ["waist", "upper legs"],
    keywords: ["warmup", "mobility", "activation", "dynamic"],
    exerciseTypes: ["warmup", "mobility"],
  },
  strength: {
    label: "Fuerza",
    targetMuscles: ["pectorals", "lats", "quadriceps", "glutes"],
    bodyParts: ["chest", "back", "upper legs", "shoulders"],
    keywords: ["press", "row", "squat", "hinge", "pull", "push"],
    exerciseTypes: ["strength"],
  },
  accessory: {
    label: "Accesorio",
    targetMuscles: ["glutes", "core", "biceps", "triceps"],
    bodyParts: ["upper legs", "waist", "upper arms", "shoulders"],
    keywords: ["raise", "curl", "triceps", "bridge", "plank", "lunge"],
    exerciseTypes: ["accessory", "isolation"],
  },
  cardio: {
    label: "Cardio",
    targetMuscles: [],
    bodyParts: ["cardio"],
    keywords: ["cardio", "bike", "rower", "treadmill"],
    exerciseTypes: ["cardio"],
  },
  mobility: {
    label: "Movilidad",
    targetMuscles: ["core", "glutes"],
    bodyParts: ["waist", "upper legs", "shoulders"],
    keywords: ["mobility", "activation", "stretch"],
    exerciseTypes: ["mobility"],
  },
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function normalizeSet(values?: string[] | null) {
  return new Set((values || []).map((item) => item.toLowerCase().trim()).filter(Boolean));
}

function collectSearchTokens(value: string) {
  return normalizeExerciseSearchText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !EXERCISE_SEARCH_STOPWORDS.has(token));
}

function normalizeKeywords(values: string[]) {
  return uniqueStrings(values.flatMap((value) => buildExerciseSearchVariants(value)).slice(0, 12));
}

function exerciseSearchText(exercise: ExerciseCatalogItem) {
  return normalizeExerciseSearchText(
    [
      exercise.name,
      exercise.display_name,
      exercise.display_name_es,
      ...exercise.keywords,
      ...exercise.target_muscles,
      ...exercise.secondary_muscles,
      ...exercise.body_parts,
      ...exercise.equipments,
      ...exercise.variations,
      exercise.exercise_type,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function getResolvedEquipment(
  equipment: EquipmentOption[] | undefined,
  trainingLocation: TrainingProfileInput["training_location"],
): EquipmentOption[] {
  const normalized = normalizeTextArray(equipment) as EquipmentOption[];
  if (normalized.length > 0) return normalized;
  if (trainingLocation === "gym") return ["full_gym"];
  return ["body_weight"];
}

function scoreTextPreference(searchText: string, rawValue: string | null | undefined) {
  if (!rawValue) return 0;

  return collectSearchTokens(rawValue).reduce((score, token) => {
    if (!searchText.includes(token)) return score;
    return score + (token.length >= 6 ? 2 : 1);
  }, 0);
}

function buildReasons(params: {
  exercise: ExerciseCatalogItem;
  intent: ExerciseSelectionIntent;
  currentExercise: ExerciseCatalogItem | null;
  profile: TrainingProfileInput;
}) {
  const { exercise, intent, currentExercise, profile } = params;
  const reasons = new Set<string>();
  const exerciseTargets = normalizeSet([...exercise.target_muscles, ...exercise.secondary_muscles]);
  const exerciseBodyParts = normalizeSet(exercise.body_parts);
  const exerciseEquipments = normalizeSet(exercise.equipments);
  const currentTargets = normalizeSet(currentExercise ? [...currentExercise.target_muscles, ...currentExercise.secondary_muscles] : []);
  const currentBodyParts = normalizeSet(currentExercise?.body_parts);
  const currentEquipments = normalizeSet(currentExercise?.equipments);
  const searchText = exerciseSearchText(exercise);

  if ((intent.targetMuscles || []).some((target) => exerciseTargets.has(target.toLowerCase()))) {
    reasons.add("Mismo grupo muscular principal");
  }

  if ((intent.bodyParts || []).some((part) => exerciseBodyParts.has(part.toLowerCase()))) {
    reasons.add("Compatible con esta zona de trabajo");
  }

  if ((intent.keywords || []).some((keyword) => searchText.includes(normalizeExerciseSearchText(keyword)))) {
    reasons.add("Mantiene un patrón de movimiento parecido");
  }

  if (currentExercise && [...exerciseTargets].some((target) => currentTargets.has(target))) {
    reasons.add("Se parece al ejercicio actual");
  }

  if (currentExercise && [...exerciseBodyParts].some((part) => currentBodyParts.has(part))) {
    reasons.add("Trabaja la misma región corporal");
  }

  if (currentExercise && [...exerciseEquipments].some((equipment) => currentEquipments.has(equipment))) {
    reasons.add("Usa el mismo equipo");
  }

  for (const focusArea of normalizeTextArray(profile.focus_areas) as FocusArea[]) {
    const matchers = FOCUS_AREA_MATCHERS[focusArea] || [];
    if (matchers.some((matcher) => searchText.includes(matcher))) {
      reasons.add("Alineado con el foco del cliente");
      break;
    }
  }

  if (scoreTextPreference(searchText, profile.exercise_preferences) > 0) {
    reasons.add("Cerca de las preferencias del cliente");
  }

  if (reasons.size === 0) {
    reasons.add(`Compatible con el bloque de ${BLOCK_FALLBACKS[intent.blockType].label.toLowerCase()}`);
  }

  return Array.from(reasons);
}

function scoreSimilarity(exercise: ExerciseCatalogItem, currentExercise: ExerciseCatalogItem | null, intent: ExerciseSelectionIntent) {
  if (!currentExercise) return 0;

  let score = 0;
  const exerciseTargets = normalizeSet([...exercise.target_muscles, ...exercise.secondary_muscles]);
  const currentTargets = normalizeSet([...currentExercise.target_muscles, ...currentExercise.secondary_muscles]);
  const exerciseBodyParts = normalizeSet(exercise.body_parts);
  const currentBodyParts = normalizeSet(currentExercise.body_parts);
  const exerciseEquipments = normalizeSet(exercise.equipments);
  const currentEquipments = normalizeSet(currentExercise.equipments);
  const currentKeywords = normalizeKeywords([
    currentExercise.name,
    currentExercise.display_name || "",
    currentExercise.display_name_es || "",
    ...currentExercise.keywords,
    ...currentExercise.variations,
    ...(intent.keywords || []),
  ]);
  const searchText = exerciseSearchText(exercise);

  for (const target of currentTargets) {
    if (exerciseTargets.has(target)) score += 6;
  }

  for (const bodyPart of currentBodyParts) {
    if (exerciseBodyParts.has(bodyPart)) score += 4;
  }

  for (const equipment of currentEquipments) {
    if (exerciseEquipments.has(equipment)) score += 3;
  }

  for (const keyword of currentKeywords) {
    if (searchText.includes(normalizeExerciseSearchText(keyword))) score += 2;
  }

  return score;
}

export function normalizeExerciseSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceWholePhrase(text: string, phrase: string, replacement: string) {
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`, "g");
  return text.replace(pattern, (_, leadingWhitespace: string) => `${leadingWhitespace}${replacement}`);
}

function buildExerciseSearchTokenVariants(token: string) {
  const normalizedToken = normalizeExerciseSearchText(token);
  if (!normalizedToken) return [];

  const variants = new Set<string>([normalizedToken]);

  if (normalizedToken.endsWith("es") && normalizedToken.length > 4) {
    variants.add(normalizedToken.slice(0, -2));
  } else if (normalizedToken.endsWith("s") && normalizedToken.length > 3) {
    variants.add(normalizedToken.slice(0, -1));
  }

  return Array.from(variants).filter((value) => value.length >= 2);
}

export function buildExerciseSearchVariants(query: string) {
  const normalized = normalizeExerciseSearchText(query);
  if (!normalized) return [];

  const variants = new Set<string>();
  const addVariant = (value: string) => {
    const cleaned = normalizeExerciseSearchText(value);
    if (cleaned.length >= 2) {
      variants.add(cleaned);
    }
  };

  addVariant(query);

  let translated = normalized;
  for (const [phrase, replacements] of EXERCISE_SEARCH_PHRASES) {
    const phrasePattern = new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`);
    if (!phrasePattern.test(translated)) continue;

    for (const replacement of replacements) {
      addVariant(replacement);
    }

    translated = replaceWholePhrase(translated, phrase, replacements[0]);
  }

  addVariant(translated);

  const tokens = translated.split(" ").filter((token) => token && !EXERCISE_SEARCH_STOPWORDS.has(token));
  if (tokens.length > 0) {
    addVariant(tokens.join(" "));
  }

  const tokenVariants = Array.from(new Set(tokens.flatMap((token) => buildExerciseSearchTokenVariants(token))));
  if (tokens.length > 1 && tokenVariants.length > 1) {
    addVariant(tokenVariants.join(" "));
  }

  const translatedTokens = Array.from(
    new Set(
      tokenVariants.flatMap((token) => EXERCISE_SEARCH_TOKEN_MAP[token] || []),
    ),
  );
  if (translatedTokens.length > 0) {
    addVariant(translatedTokens.join(" "));
  }

  for (const token of tokenVariants) {
    addVariant(token);
    for (const replacement of EXERCISE_SEARCH_TOKEN_MAP[token] || []) {
      addVariant(replacement);
    }
  }

  return Array.from(variants).slice(0, 8);
}

export function getExerciseDisplayName(exercise: ExerciseCatalogItem) {
  return exercise.display_name_es || exercise.display_name || exercise.name;
}

export function matchesExerciseCatalogQuery(item: ExerciseCatalogItem, variants: string[]) {
  if (variants.length === 0) return true;
  return variants.some((variant) => exerciseSearchText(item).includes(variant));
}

export function searchExerciseCatalogItems(
  catalog: ExerciseCatalogItem[],
  filters: {
    query?: string;
    bodyPart?: string;
    targetMuscle?: string;
    equipment?: string;
    limit?: number;
  },
) {
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 50);
  const variants = buildExerciseSearchVariants(filters.query || "");
  const normalizedBodyPart = filters.bodyPart ? normalizeExerciseSearchText(filters.bodyPart) : null;
  const normalizedTargetMuscle = filters.targetMuscle ? normalizeExerciseSearchText(filters.targetMuscle) : null;
  const normalizedEquipment = filters.equipment ? normalizeExerciseSearchText(filters.equipment) : null;

  const scored = catalog
    .filter((item) => {
      if (!matchesExerciseCatalogQuery(item, variants)) return false;

      if (normalizedBodyPart && !item.body_parts.some((part) => normalizeExerciseSearchText(part) === normalizedBodyPart)) {
        return false;
      }

      if (
        normalizedTargetMuscle &&
        !item.target_muscles.some((muscle) => normalizeExerciseSearchText(muscle) === normalizedTargetMuscle)
      ) {
        return false;
      }

      if (
        normalizedEquipment &&
        !item.equipments.some((equipment) => normalizeExerciseSearchText(equipment) === normalizedEquipment)
      ) {
        return false;
      }

      return true;
    })
    .map((item) => {
      const searchableText = exerciseSearchText(item);
      const score = variants.reduce((total, variant) => {
        if (!variant) return total;
        if (searchableText.startsWith(variant)) return total + 6;
        if (searchableText.includes(variant)) return total + 3;
        return total;
      }, 0);

      return { item, score };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return getExerciseDisplayName(left.item).localeCompare(getExerciseDisplayName(right.item), "es");
    });

  return scored.slice(0, limit).map(({ item }) => item);
}

export function isEquipmentCompatible(
  exercise: ExerciseCatalogItem,
  availableEquipment: EquipmentOption[],
  trainingLocation: TrainingProfileInput["training_location"],
) {
  const exerciseEquipment = normalizeSet(exercise.equipments);
  if (trainingLocation === "gym" && availableEquipment.includes("full_gym")) return true;
  if (exerciseEquipment.size === 0) return true;
  if (exerciseEquipment.has("body weight") || exerciseEquipment.has("bodyweight")) return true;

  const normalizedAvailable = new Set(
    availableEquipment.map((item) =>
      item === "body_weight" ? "body weight" : item === "machine" ? "machine" : item.toLowerCase().replaceAll("_", " "),
    ),
  );

  for (const equipment of exerciseEquipment) {
    if (normalizedAvailable.has(equipment)) return true;
  }

  return false;
}

export function isExerciseCompatibleForProfile(exercise: ExerciseCatalogItem, profileInput: TrainingProfileInput | null | undefined) {
  const profile = normalizeTrainingProfileInput(profileInput || {});
  if (!exercise.is_active) return false;
  if (
    !isEquipmentCompatible(
      exercise,
      getResolvedEquipment(profile.equipment_available as EquipmentOption[], profile.training_location),
      profile.training_location,
    )
  ) {
    return false;
  }

  const searchable = exerciseSearchText(exercise);
  for (const restriction of normalizeTextArray(profile.restricted_movements) as RestrictedMovement[]) {
    const patterns = RESTRICTION_MATCHERS[restriction] || [];
    if (patterns.some((pattern) => searchable.includes(pattern))) {
      return false;
    }
  }

  return true;
}

export function scoreExerciseForIntent(
  exercise: ExerciseCatalogItem,
  intent: ExerciseSelectionIntent,
  profileInput: TrainingProfileInput | null | undefined,
) {
  const profile = normalizeTrainingProfileInput(profileInput || {});
  let score = 0;
  const searchText = exerciseSearchText(exercise);
  const targetMuscles = normalizeSet([...exercise.target_muscles, ...exercise.secondary_muscles]);
  const bodyParts = normalizeSet(exercise.body_parts);
  const equipments = normalizeSet(exercise.equipments);

  for (const target of intent.targetMuscles || []) {
    if (targetMuscles.has(target.toLowerCase())) score += 6;
    if (searchText.includes(target.toLowerCase())) score += 2;
  }

  for (const bodyPart of intent.bodyParts || []) {
    if (bodyParts.has(bodyPart.toLowerCase())) score += 5;
    if (searchText.includes(bodyPart.toLowerCase())) score += 1;
  }

  for (const keyword of intent.keywords || []) {
    if (searchText.includes(normalizeExerciseSearchText(keyword))) score += 3;
  }

  for (const equipment of intent.equipments || []) {
    if (equipments.has(equipment.toLowerCase())) score += 3;
  }

  if (intent.exerciseTypes?.length && intent.exerciseTypes.includes(exercise.exercise_type || "")) {
    score += 2;
  }

  for (const focusArea of normalizeTextArray(profile.focus_areas) as FocusArea[]) {
    const matchers = FOCUS_AREA_MATCHERS[focusArea] || [];
    if (matchers.some((matcher) => searchText.includes(matcher))) {
      score += 2;
    }
  }

  if (profile.experience_level === "beginner" && COMPLEXITY_KEYWORDS.some((keyword) => searchText.includes(keyword))) {
    score -= 4;
  }

  score += Math.min(scoreTextPreference(searchText, profile.exercise_preferences), 4);
  score -= Math.min(scoreTextPreference(searchText, profile.exercise_dislikes) * 2, 6);
  score -= Math.min(scoreTextPreference(searchText, profile.injuries_or_pain), 4);

  if (exercise.provider === "starter_pack") {
    score += 1;
  }

  return score;
}

export function buildRoutineReplacementContext(
  detail: RoutineDetailRecord,
  currentExercise: ExerciseCatalogItem | null,
): RoutineReplacementContext {
  const fallback = BLOCK_FALLBACKS[detail.block_type];
  const currentName = currentExercise
    ? getExerciseDisplayName(currentExercise)
    : detail.exercise_name_snapshot || `${fallback.label} actual`;

  const keywords = normalizeKeywords([
    ...fallback.keywords,
    currentName,
    detail.exercise_name_snapshot || "",
    ...(currentExercise?.keywords || []),
    ...(currentExercise?.variations || []),
    ...(currentExercise?.target_muscles || []),
  ]);

  return {
    detailId: detail.id,
    routineId: detail.routine_id,
    blockType: detail.block_type,
    dayOfWeek: detail.day_of_week,
    currentExerciseId: currentExercise?.id ?? detail.exercise_id ?? null,
    currentExerciseName: currentName,
    targetMuscles: uniqueStrings([...(currentExercise?.target_muscles || []), ...(currentExercise?.secondary_muscles || []), ...fallback.targetMuscles]),
    bodyParts: uniqueStrings([...(currentExercise?.body_parts || []), ...fallback.bodyParts]),
    equipments: uniqueStrings(currentExercise?.equipments || []),
    keywords,
  };
}

function mapReplacementOption(
  exercise: ExerciseCatalogItem,
  reason: string,
  score: number,
): ExerciseReplacementOption {
  return {
    id: exercise.id,
    name: getExerciseDisplayName(exercise),
    imageUrl: exercise.image_url,
    bodyParts: exercise.body_parts,
    targetMuscles: exercise.target_muscles,
    equipments: exercise.equipments,
    reason,
    score,
  };
}

export function buildExerciseReplacementGroups(params: {
  catalog: ExerciseCatalogItem[];
  detail: RoutineDetailRecord;
  currentExercise: ExerciseCatalogItem | null;
  trainingProfile: TrainingProfileInput | null | undefined;
  limitPerGroup?: number;
}) {
  const { catalog, detail, currentExercise, trainingProfile } = params;
  const limitPerGroup = Math.min(Math.max(params.limitPerGroup ?? 6, 3), 10);
  const normalizedProfile = normalizeTrainingProfileInput(trainingProfile || {});
  const context = buildRoutineReplacementContext(detail, currentExercise);
  const intent: ExerciseSelectionIntent = {
    blockType: detail.block_type,
    label: BLOCK_FALLBACKS[detail.block_type].label,
    targetMuscles: context.targetMuscles,
    bodyParts: context.bodyParts,
    equipments: context.equipments,
    keywords: context.keywords,
    exerciseTypes: BLOCK_FALLBACKS[detail.block_type].exerciseTypes,
  };

  const ranked = catalog
    .filter((exercise) => exercise.id !== context.currentExerciseId)
    .filter((exercise) => isExerciseCompatibleForProfile(exercise, normalizedProfile))
    .map((exercise) => {
      const baseScore = scoreExerciseForIntent(exercise, intent, normalizedProfile);
      const similarityScore = scoreSimilarity(exercise, currentExercise, intent);
      const totalScore = baseScore + similarityScore;

      return {
        exercise,
        baseScore,
        similarityScore,
        totalScore,
        reasons: buildReasons({
          exercise,
          intent,
          currentExercise,
          profile: normalizedProfile,
        }),
      };
    })
    .filter((candidate) => candidate.totalScore > 0)
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) return right.totalScore - left.totalScore;
      return getExerciseDisplayName(left.exercise).localeCompare(getExerciseDisplayName(right.exercise), "es");
    });

  const used = new Set<number>();
  const takeGroup = (
    key: string,
    title: string,
    description: string,
    predicate: (candidate: (typeof ranked)[number]) => boolean,
  ): ExerciseReplacementGroup | null => {
    const options = ranked
      .filter((candidate) => !used.has(candidate.exercise.id))
      .filter(predicate)
      .slice(0, limitPerGroup)
      .map((candidate) => {
        used.add(candidate.exercise.id);
        return mapReplacementOption(candidate.exercise, candidate.reasons.slice(0, 2).join(" · "), candidate.totalScore);
      });

    if (options.length === 0) return null;
    return { key, title, description, options };
  };

  const groups: ExerciseReplacementGroup[] = [];

  const recommendedGroup = takeGroup(
    "recommended",
    "Recomendadas para este bloque",
    "Opciones listas para usar con el mismo nivel de compatibilidad del plan actual.",
    (candidate) => candidate.baseScore >= 12 || candidate.totalScore >= 18,
  );
  if (recommendedGroup) groups.push(recommendedGroup);

  const similarGroup = takeGroup(
    "similar",
    "Similares a este ejercicio",
    "Variantes que mantienen la intención del ejercicio actual.",
    (candidate) => candidate.similarityScore >= 8,
  );
  if (similarGroup) groups.push(similarGroup);

  const catalogGroup = takeGroup(
    "catalog",
    "Más opciones del catálogo",
    "Alternativas viables dentro del catálogo local por si quieres ajustar el estímulo.",
    () => true,
  );
  if (catalogGroup) groups.push(catalogGroup);

  return {
    context,
    groups,
  };
}
