import { format } from "date-fns";

// Balancea años abreviados para fechas de membresía cercanas y fechas de nacimiento antiguas.
function expandTwoDigitYear(year: number) {
  return year >= 50 ? 1900 + year : 2000 + year;
}

export function parseFlexibleDateInput(rawValue: string): Date | null {
  const normalizedValue = rawValue.trim();
  if (!normalizedValue) return null;

  const parts = normalizedValue.split(/[^\d]+/).filter(Boolean);
  if (parts.length !== 3) return null;

  const [dayToken, monthToken, yearToken] = parts;
  if (dayToken.length > 2 || monthToken.length > 2 || yearToken.length < 2 || yearToken.length > 4) {
    return null;
  }

  const day = Number(dayToken);
  const month = Number(monthToken);
  const year = yearToken.length === 2 ? expandTwoDigitYear(Number(yearToken)) : Number(yearToken);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (day < 1 || month < 1 || month > 12 || year < 1900 || year > 2100) return null;

  const parsedDate = new Date(year, month - 1, day);
  if (Number.isNaN(parsedDate.getTime())) return null;
  if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) {
    return null;
  }

  return parsedDate;
}

export function formatDateInputValue(date?: Date) {
  return date ? format(date, "dd/MM/yyyy") : "";
}
