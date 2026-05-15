const POUNDS_PER_KILOGRAM = 2.2046226218;

export function kilogramsToPounds(value: number | null | undefined, precision = 1) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Number((value * POUNDS_PER_KILOGRAM).toFixed(precision));
}

export function poundsToKilograms(value: number | null | undefined, precision = 4) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Number((value / POUNDS_PER_KILOGRAM).toFixed(precision));
}
