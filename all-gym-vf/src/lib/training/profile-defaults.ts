import type { EquipmentOption, TrainingLocation } from "@/lib/training/types";

export const DEFAULT_TRAINING_LOCATION: TrainingLocation = "gym";
export const DEFAULT_EQUIPMENT_AVAILABLE: EquipmentOption[] = [
  "full_gym",
  "body_weight",
  "dumbbell",
  "barbell",
  "machine",
  "treadmill",
  "bike",
  "rower",
];

export function splitSessionMinutes(totalMinutes: number | null | undefined) {
  if (typeof totalMinutes !== "number" || !Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return {
      hours: 0,
      minutes: 0,
    };
  }

  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function combineSessionDuration(hours: number | null | undefined, minutes: number | null | undefined) {
  const normalizedHours = typeof hours === "number" && Number.isFinite(hours) ? Math.max(0, Math.trunc(hours)) : 0;
  const normalizedMinutes =
    typeof minutes === "number" && Number.isFinite(minutes) ? Math.max(0, Math.trunc(minutes)) : 0;
  const totalMinutes = normalizedHours * 60 + normalizedMinutes;

  return totalMinutes > 0 ? totalMinutes : null;
}

export function formatSessionDuration(totalMinutes: number | null | undefined) {
  if (typeof totalMinutes !== "number" || !Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return null;
  }

  const { hours, minutes } = splitSessionMinutes(totalMinutes);
  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} min`;
  }

  if (hours > 0) {
    return `${hours} h`;
  }

  return `${minutes} min`;
}
