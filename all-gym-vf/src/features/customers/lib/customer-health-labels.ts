import {
  CARDIO_PREFERENCE_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  FOCUS_AREA_OPTIONS,
  PRIMARY_GOAL_OPTIONS,
  RESTRICTED_MOVEMENT_OPTIONS,
  TRAINING_LOCATION_OPTIONS,
} from "@/lib/training/options";

function labelsFromOptions(options: ReadonlyArray<{ value: string; label: string }>): Record<string, string> {
  return Object.fromEntries(options.map(({ value, label }) => [value, label]));
}

const healthLabels: Record<string, Record<string, string>> = {
  primary_goal: labelsFromOptions(PRIMARY_GOAL_OPTIONS),
  secondary_goal: labelsFromOptions(PRIMARY_GOAL_OPTIONS),
  focus_areas: labelsFromOptions(FOCUS_AREA_OPTIONS),
  experience_level: labelsFromOptions(EXPERIENCE_LEVEL_OPTIONS),
  training_location: labelsFromOptions(TRAINING_LOCATION_OPTIONS),
  equipment_available: labelsFromOptions(EQUIPMENT_OPTIONS),
  cardio_preference: labelsFromOptions(CARDIO_PREFERENCE_OPTIONS),
  restricted_movements: labelsFromOptions(RESTRICTED_MOVEMENT_OPTIONS),
  body_type: {
    ectomorph: "Ectomorfo",
    mesomorph: "Mesomorfo",
    endomorph: "Endomorfo",
  },
  diet_type: {
    hipocalorica: "Hipocalórica",
    normocalorica: "Normocalórica",
    hipercalorica: "Hipercalórica",
  },
  activity_level: {
    sedentario: "Poco o nada",
    "1_3_dias": "1 a 3 días por semana",
    "3_5_dias": "3 a 5 días por semana",
    "6_7_dias": "6 a 7 días por semana",
    "2_veces_dia": "2 veces al día",
  },
};

export function healthValueOptions(field: string): Array<{ value: string; label: string }> {
  return Object.entries(healthLabels[field] ?? {}).map(([value, label]) => ({ value, label }));
}

export function displayHealthValue(
  field: string,
  value: string | number | string[] | null | undefined,
  emptyText = "Sin información",
): string {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return emptyText;
  }

  const label = (item: string) => healthLabels[field]?.[item.trim()] ?? item.trim();
  if (Array.isArray(value)) return value.map(label).join(", ");
  if (field === "restricted_movements" && typeof value === "string") {
    return value.split(",").map(label).join(", ");
  }
  return label(String(value));
}
