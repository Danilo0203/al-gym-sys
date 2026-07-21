"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import * as z from "zod";
import { addDays, addMonths, differenceInDays, endOfMonth } from "date-fns";
import { DEFAULT_SUBSCRIPTION_GRACE_DAYS, normalizeGraceDays } from "@/lib/subscriptions/grace-period";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { computeFitnessPlan } from "@/lib/fitness/excel-calculator";
import { kilogramsToPounds, poundsToKilograms } from "@/lib/fitness/measurements";
import type { ActivityLevel, BodyType, DietType } from "@/lib/fitness/types";
import { combineSessionDuration, DEFAULT_EQUIPMENT_AVAILABLE, DEFAULT_TRAINING_LOCATION, splitSessionMinutes } from "@/lib/training/profile-defaults";
import { useLocalMembership, useLocalPlans } from "@/features/customers/hooks/use-local-memberships";
import { usePlans } from "@/features/plans/hooks/use-plans";
import {
  createMembershipForCustomer,
  renewMembershipForCustomer,
  type Membership,
  type MembershipWriteInput,
} from "@/features/customers/lib/local-memberships";
import type { EquipmentOption, FocusArea, PrimaryGoal, RestrictedMovement, TrainingProfileInput, TrainingProfileStatus } from "@/lib/training/types";
import {
  createCustomer as createLegacyCustomer,
  renewSubscription,
  type CreateCustomerData,
  updateCustomer as updateLegacyCustomer,
} from "../actions/customer-actions";
import { useCreateCustomer, useReactivateCustomer, useUpdateCustomer } from "./use-customers";
import { isValidAuthEmail } from "@/lib/auth/identifiers";
import {
  isValidCalendarDateString,
  normalizeOptionalCustomerEmail,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/features/customers/lib/local-customers";

const profileCustomerSchema = z.object({
  full_name: z.string().min(2, {
    message: "El nombre debe tener al menos 2 caracteres.",
  }),
  phone: z.string().optional().or(z.literal("")),
  birth_date: z.date().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional(),
  emergency_contact: z.string().optional().or(z.literal("")),
  emergency_phone: z.string().optional().or(z.literal("")),
  injuries: z.string().optional().or(z.literal("")),
  medical_notes: z.string().optional().or(z.literal("")),
});

const optionalPositiveNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined || Number(value) === 0) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? value : num;
}, z.number({ message: "Debe ser un número" }).positive({ message: "Debe ser mayor a 0" }).optional());

const optionalPercentageNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined || Number(value) === 0) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? value : num;
}, z.number({ message: "Debe ser un número" }).min(1, { message: "Debe ser mayor a 0" }).max(100, { message: "Máximo 100" }).optional());

const optionalBoundedInteger = (min: number, max: number, invalidMessage: string) =>
  z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }, z.number({ message: invalidMessage }).int({ message: invalidMessage }).min(min).max(max).optional());

const graceDaysSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return DEFAULT_SUBSCRIPTION_GRACE_DAYS;
  if (value === "") return value;
  const num = Number(value);
  return Number.isNaN(num) ? value : num;
}, z.number({ message: "La prórroga es obligatoria" }).int({ message: "La prórroga debe ser un número entero" }).min(0, { message: "La prórroga no puede ser negativa" }));

function normalizeTextFieldValue(
  value: string | null | undefined,
): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

const dateModeValues = ["automatic", "manual"] as const;

export function calculateSubscriptionEndDate(startDate: Date, planDurationDays: number) {
  return addDays(startDate, planDurationDays);
}

export function calculateNextSubscriptionStartDate(previousStartDate?: Date | null) {
  if (!previousStartDate) return new Date();

  const nextMonthSameDay = addMonths(previousStartDate, 1);
  if (nextMonthSameDay.getDate() === previousStartDate.getDate()) {
    return nextMonthSameDay;
  }

  return endOfMonth(nextMonthSameDay);
}

interface MembershipPricingSummary {
  selectedDays: number;
  isExactMultiple: boolean;
  suggestedCycles: number;
  suggestedBasePrice: number;
  suggestedFinalPrice: number;
}

function calculateMembershipPricing(params: {
  planPrice?: number | null;
  planDurationDays?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  discountAmount?: number | null;
}): MembershipPricingSummary | null {
  const { planPrice, planDurationDays, startDate, endDate, discountAmount } = params;

  if (
    typeof planPrice !== "number" ||
    !Number.isFinite(planPrice) ||
    typeof planDurationDays !== "number" ||
    !Number.isFinite(planDurationDays) ||
    planDurationDays <= 0 ||
    !startDate ||
    !endDate
  ) {
    return null;
  }

  const selectedDays = differenceInDays(endDate, startDate);
  if (!Number.isFinite(selectedDays) || selectedDays <= 0) {
    return null;
  }

  const exactCycles = selectedDays / planDurationDays;
  const isExactMultiple = Number.isInteger(exactCycles);
  const suggestedCycles = isExactMultiple ? exactCycles : Math.ceil(exactCycles);
  const suggestedBasePrice = Math.max(0, planPrice * suggestedCycles);
  const normalizedDiscount = typeof discountAmount === "number" && Number.isFinite(discountAmount) ? discountAmount : 0;

  return {
    selectedDays,
    isExactMultiple,
    suggestedCycles,
    suggestedBasePrice,
    suggestedFinalPrice: Math.max(0, suggestedBasePrice - normalizedDiscount),
  };
}

function buildMembershipPricingContextKey(params: {
  planId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  discountAmount?: number | null;
}) {
  const { planId, startDate, endDate, discountAmount } = params;
  return [
    planId || "",
    startDate?.getTime() ?? "",
    endDate?.getTime() ?? "",
    typeof discountAmount === "number" && Number.isFinite(discountAmount) ? discountAmount : 0,
  ].join("|");
}

const primaryGoalValues = ["fat_loss", "muscle_gain", "recomp", "strength", "general_fitness", "cardio"] as const;
const experienceLevelValues = ["beginner", "intermediate", "advanced"] as const;
const trainingLocationValues = ["gym", "home", "mixed"] as const;
const cardioPreferenceValues = ["none", "light", "moderate", "high"] as const;
const focusAreaValues = [
  "upper_body",
  "lower_body",
  "glutes",
  "core",
  "chest",
  "back",
  "shoulders",
  "arms",
  "conditioning",
] as const;
const equipmentOptionValues = [
  "full_gym",
  "body_weight",
  "dumbbell",
  "barbell",
  "machine",
  "bands",
  "kettlebell",
  "treadmill",
  "bike",
  "rower",
] as const;
const restrictedMovementValues = [
  "deep_knee_flexion",
  "overhead_pressing",
  "loaded_spinal_flexion",
  "high_impact",
  "horizontal_pressing",
  "vertical_pulling",
  "hip_hinge",
  "unilateral_lower_body",
] as const;
const parqChoiceValues = ["yes", "no"] as const;
const daysPerWeekValues = ["1", "2", "3", "4", "5", "6", "7"] as const;

const optionalEmailSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value === "" || isValidAuthEmail(value), {
    message: "Correo electrónico inválido",
  });

const customerSheetSchema = z
  .object({
    email: optionalEmailSchema,
    password: z.string().min(6, { message: "Mínimo 6 caracteres" }).optional().or(z.literal("")),
    full_name: z.string().min(2, { message: "El nombre es obligatorio" }),
    birth_date: z.date({ message: "La fecha de nacimiento es obligatoria" }),
    gender: z.enum(["male", "female", "other"], { message: "Selecciona el género" }),
    phone: z.string().regex(/^\d{8}$/, { message: "El teléfono debe tener exactamente 8 dígitos" }),
    plan_id: z.string().optional(),
    final_price: z.number().optional(),
    discount_amount: z.coerce.number().min(0).default(0),
    grace_days: graceDaysSchema,
    date_mode: z.enum(dateModeValues).default("automatic"),
    payment_method: z.enum(["cash", "card", "transfer"]).default("cash"),
    subscription_period: z
      .object({
        from: z.date().optional(),
        to: z.date().optional(),
      })
      .optional(),
    primary_goal: z.enum(primaryGoalValues).optional(),
    secondary_goal: z.enum(primaryGoalValues).optional(),
    focus_areas: z.array(z.enum(focusAreaValues)).default([]),
    experience_level: z.enum(experienceLevelValues).optional(),
    days_per_week: z.enum(daysPerWeekValues).optional(),
    session_hours: z.coerce.number().int().min(0).max(8).default(0),
    session_minutes_extra: z.coerce.number().int().min(0).max(59).default(0),
    training_location: z.enum(trainingLocationValues).default(DEFAULT_TRAINING_LOCATION),
    equipment_available: z.array(z.enum(equipmentOptionValues)).default(DEFAULT_EQUIPMENT_AVAILABLE),
    cardio_preference: z.enum(cardioPreferenceValues).optional(),
    parq_requires_attention: z.enum(parqChoiceValues).optional(),
    restricted_movements: z.array(z.enum(restrictedMovementValues)).default([]),
    exercise_preferences: z.string().optional().or(z.literal("")),
    exercise_dislikes: z.string().optional().or(z.literal("")),
    injuries_or_pain: z.string().optional().or(z.literal("")),
    medical_clearance_notes: z.string().optional().or(z.literal("")),
    weight_lb: optionalPositiveNumber,
    height_cm: optionalPositiveNumber,
    diet_type: z.enum(["hipocalorica", "normocalorica", "hipercalorica"]).optional(),
    activity_level: z.enum(["sedentario", "1_3_dias", "3_5_dias", "6_7_dias", "2_veces_dia"]).optional(),
    body_fat_percentage: optionalPercentageNumber,
    muscle_mass_kg: optionalPositiveNumber,
    chest: optionalPositiveNumber,
    waist: optionalPositiveNumber,
    hip: optionalPositiveNumber,
    arm_right: optionalPositiveNumber,
    arm_left: optionalPositiveNumber,
    leg_right: optionalPositiveNumber,
    leg_left: optionalPositiveNumber,
    injuries: z.string().optional().or(z.literal("")),
    medical_notes: z.string().optional().or(z.literal("")),
    body_type: z.enum(["ectomorph", "mesomorph", "endomorph"]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.plan_id) {
      const startDate = value.subscription_period?.from;
      const endDate = value.subscription_period?.to;
      if (!startDate || !endDate || differenceInDays(endDate, startDate) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subscription_period"],
          message: "La membresía debe terminar después de la fecha de inicio.",
        });
      }
    }

    const sessionMinutes = combineSessionDuration(
      value.session_hours,
      value.session_minutes_extra,
    );

    if (sessionMinutes !== null && sessionMinutes > 480) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["session_hours"],
        message: "La duración por sesión no puede superar 8 horas.",
      });
    }

    if (
      value.parq_requires_attention === "yes" &&
      !normalizeTextFieldValue(value.injuries_or_pain)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["injuries_or_pain"],
        message: "Explica por qué requiere atención antes de entrenar.",
      });
    }
  });

const renewSubscriptionSchema = z
  .object({
    plan_id: z.string().min(1, "Selecciona un plan"),
    subscription_period: z.object({
      from: z.date({ message: "La fecha de inicio es obligatoria" }),
      to: z.date({ message: "La fecha de fin es obligatoria" }),
    }),
    price: z.number(),
    discount_amount: z.coerce.number().min(0).default(0),
    grace_days: graceDaysSchema,
    date_mode: z.enum(dateModeValues).default("automatic"),
    final_price: z.number(),
    payment_method: z.enum(["cash", "card", "transfer"]),
    weight_lb: optionalPositiveNumber,
    height_cm: optionalPositiveNumber,
    body_type: z.enum(["ectomorph", "mesomorph", "endomorph"]).optional(),
    diet_type: z.enum(["hipocalorica", "normocalorica", "hipercalorica"]).optional(),
    activity_level: z.enum(["sedentario", "1_3_dias", "3_5_dias", "6_7_dias", "2_veces_dia"]).optional(),
    body_fat_percentage: optionalPercentageNumber,
    muscle_mass_kg: optionalPositiveNumber,
    chest: optionalPositiveNumber,
    waist: optionalPositiveNumber,
    hip: optionalPositiveNumber,
    arm_right: optionalPositiveNumber,
    arm_left: optionalPositiveNumber,
    leg_right: optionalPositiveNumber,
    leg_left: optionalPositiveNumber,
    injuries: z.string().optional().or(z.literal("")),
    primary_goal: z.enum(primaryGoalValues).optional(),
    secondary_goal: z.enum(primaryGoalValues).optional(),
    focus_areas: z.array(z.enum(focusAreaValues)).default([]),
    experience_level: z.enum(experienceLevelValues).optional(),
    days_per_week: z.enum(daysPerWeekValues).optional(),
    session_hours: optionalBoundedInteger(0, 8, "Las horas deben estar entre 0 y 8"),
    session_minutes_extra: optionalBoundedInteger(0, 59, "Los minutos deben estar entre 0 y 59"),
    training_location: z.enum(trainingLocationValues).optional(),
    equipment_available: z.array(z.enum(equipmentOptionValues)).default([]),
    cardio_preference: z.enum(cardioPreferenceValues).optional(),
    parq_requires_attention: z.enum(parqChoiceValues).optional(),
    restricted_movements: z.array(z.enum(restrictedMovementValues)).default([]),
    exercise_preferences: z.string().optional().or(z.literal("")),
    exercise_dislikes: z.string().optional().or(z.literal("")),
    injuries_or_pain: z.string().optional().or(z.literal("")),
    medical_clearance_notes: z.string().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const sessionMinutes = combineSessionDuration(
      value.session_hours,
      value.session_minutes_extra,
    );

    if (sessionMinutes !== null && sessionMinutes > 480) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["session_hours"],
        message: "La duración por sesión no puede superar 8 horas.",
      });
    }

    if (
      value.parq_requires_attention === "yes" &&
      !normalizeTextFieldValue(value.injuries_or_pain)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["injuries_or_pain"],
        message: "Explica por qué requiere atención antes de entrenar.",
      });
    }
  });

function toOptionalBodyType(value?: string | null): BodyType | undefined {
  if (value === "ectomorph" || value === "mesomorph" || value === "endomorph") return value;
  return undefined;
}

function toOptionalDietType(value?: string | null): DietType | undefined {
  if (value === "hipocalorica" || value === "normocalorica" || value === "hipercalorica") return value;
  return undefined;
}

function toOptionalActivityLevel(value?: string | null): ActivityLevel | undefined {
  if (value === "sedentario" || value === "1_3_dias" || value === "3_5_dias" || value === "6_7_dias" || value === "2_veces_dia") {
    return value;
  }
  return undefined;
}

function parseDatabaseDate(dateString: Date | string | null | undefined): Date | undefined {
  if (!dateString) return undefined;
  if (dateString instanceof Date) return dateString;
  if (typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeOptionalCustomerTextareaToBackend(value?: string | null) {
  return value?.trim() ?? "";
}

function hasMeaningfulText(value?: string | null) {
  return normalizeOptionalCustomerTextareaToBackend(value).length > 0;
}

function areSameNumber(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.0001;
}

function toIsoDateString(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPhaseACreatePayload(values: CustomerSheetFormValues): CreateCustomerInput {
  const birthDate = toIsoDateString(values.birth_date);

  if (!isValidCalendarDateString(birthDate)) {
    throw new Error("La fecha de nacimiento no es válida.");
  }

  return {
    full_name: values.full_name.trim(),
    phone: values.phone.trim(),
    birth_date: birthDate,
    gender: values.gender,
    email: normalizeOptionalCustomerEmail(values.email),
    injuries: normalizeOptionalCustomerTextareaToBackend(values.injuries),
    medical_notes: normalizeOptionalCustomerTextareaToBackend(values.medical_notes),
  };
}

function buildBasicMembershipPayload(
  values: CustomerSheetFormValues,
  suggestedCycles: number | null | undefined,
): MembershipWriteInput | null {
  if (!values.plan_id) return null;

  const startDate = values.subscription_period?.from ?? new Date();
  const startDateIso = toIsoDateString(startDate);
  if (!isValidCalendarDateString(startDateIso)) {
    throw new Error("La fecha de inicio de la membresía no es válida.");
  }

  return {
    plan_id: Number(values.plan_id),
    cycles: Math.max(1, suggestedCycles ?? 1),
    start_date: startDateIso,
  };
}

function isSameBasicMembership(
  current: Membership | null | undefined,
  target: MembershipWriteInput | null,
): boolean {
  return Boolean(
    current &&
      target &&
      current.plan_id === target.plan_id &&
      current.cycles === target.cycles &&
      current.start_date === target.start_date,
  );
}

function buildPhaseAUpdatePayload(
  values: CustomerSheetFormValues,
  customer: CustomerData,
): UpdateCustomerInput | null {
  const payload: UpdateCustomerInput = {};
  const birthDate = toIsoDateString(values.birth_date);

  if (!isValidCalendarDateString(birthDate)) {
    throw new Error("La fecha de nacimiento no es válida.");
  }

  const fullName = values.full_name.trim();
  if (fullName !== (customer.full_name || "").trim()) {
    payload.full_name = fullName;
  }

  const phone = values.phone.trim();
  if (phone !== (customer.phone || "").trim()) {
    payload.phone = phone;
  }

  if (birthDate !== (customer.birth_date || "")) {
    payload.birth_date = birthDate;
  }

  if (values.gender !== customer.gender) {
    payload.gender = values.gender;
  }

  const injuries = normalizeOptionalCustomerTextareaToBackend(values.injuries);
  const currentInjuries = normalizeOptionalCustomerTextareaToBackend(customer.injuries);
  if (injuries !== currentInjuries) {
    payload.injuries = injuries;
  }

  const medicalNotes = normalizeOptionalCustomerTextareaToBackend(values.medical_notes);
  const currentMedicalNotes = normalizeOptionalCustomerTextareaToBackend(customer.medical_notes);
  if (medicalNotes !== currentMedicalNotes) {
    payload.medical_notes = medicalNotes;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

export interface ProfileFormData {
  id?: string;
  full_name: string | null;
  phone: string | null;
  birth_date?: string | null;
  gender?: "male" | "female" | "other" | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  injuries?: string | null;
  medical_notes?: string | null;
}

export type ProfileCustomerFormValues = z.infer<typeof profileCustomerSchema>;
export type CustomerSheetFormValues = z.infer<typeof customerSheetSchema>;
export type RenewSubscriptionFormValues = z.infer<typeof renewSubscriptionSchema>;

export interface CustomerData {
  id: string;
  is_active?: boolean | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  plan_id?: number | null;
  subscription_start_date?: string | null;
  subscription_end_date?: string | null;
  subscription_grace_days?: number | null;
  discount_amount?: number | null;
  final_price?: number | null;
  payment_method?: string | null;
  training_profile_status?: TrainingProfileStatus | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  injuries?: string | null;
  medical_notes?: string | null;
  body_type?: string | null;
  diet_type?: string | null;
  activity_level?: string | null;
  body_fat_percentage?: number | null;
  muscle_mass_kg?: number | null;
  chest?: number | null;
  waist?: number | null;
  hip?: number | null;
  arm_right?: number | null;
  arm_left?: number | null;
  leg_right?: number | null;
  leg_left?: number | null;
  primary_goal?: PrimaryGoal | null;
  secondary_goal?: PrimaryGoal | null;
  focus_areas?: FocusArea[] | null;
  experience_level?: "beginner" | "intermediate" | "advanced" | null;
  days_per_week?: number | null;
  session_minutes?: number | null;
  training_location?: "gym" | "home" | "mixed" | null;
  equipment_available?: EquipmentOption[] | null;
  cardio_preference?: "none" | "light" | "moderate" | "high" | null;
  exercise_preferences?: string | null;
  exercise_dislikes?: string | null;
  injuries_or_pain?: string | null;
  restricted_movements?: RestrictedMovement[] | null;
  parq_requires_attention?: boolean | null;
  medical_clearance_notes?: string | null;
}

interface UseHookFormCustomerProfileParams {
  initialData: ProfileFormData | null;
}

export function useHookFormCustomerProfile({ initialData }: UseHookFormCustomerProfileParams) {
  const router = useRouter();
  const form = useForm<ProfileCustomerFormValues>({
    resolver: zodResolver(profileCustomerSchema),
    defaultValues: {
      full_name: initialData?.full_name || "",
      phone: initialData?.phone || "",
      birth_date: initialData?.birth_date ? new Date(initialData.birth_date) : undefined,
      gender: initialData?.gender || "male",
      emergency_contact: initialData?.emergency_contact || "",
      emergency_phone: initialData?.emergency_phone || "",
      injuries: initialData?.injuries || "",
      medical_notes: initialData?.medical_notes || "",
    },
  });

  const onSubmit = (values: ProfileCustomerFormValues) => {
    console.log(values);
    router.push("/panel/clientes");
  };

  return {
    form,
    onSubmit,
    onCancel: () => router.back(),
  };
}

interface UseHookFormCustomerSheetParams {
  mode?: "create" | "edit";
  customer?: CustomerData | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  entrypoint?: "customers" | "cash";
}

export function useHookFormCustomerSheet({
  mode = "create",
  customer = null,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  entrypoint = "customers",
}: UseHookFormCustomerSheetParams) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const previousDateStateRef = useRef<{ dateMode?: CustomerSheetFormValues["date_mode"]; planId: string | null; startTime: number | null }>({
    dateMode: "automatic",
    planId: null,
    startTime: null,
  });
  const { data: plans = [] } = useLocalPlans();
  const { data: localMembership } = useLocalMembership(customer?.id);
  const { mutateAsync: createCustomerMutation, isPending: isCreating } = useCreateCustomer();
  const { mutateAsync: updateCustomerMutation, isPending: isUpdating } = useUpdateCustomer();
  const { mutateAsync: reactivateCustomerMutation } = useReactivateCustomer();
  const [isLegacySubmitting, setIsLegacySubmitting] = useState(false);
  const isPending = isCreating || isUpdating || isLegacySubmitting;
  const isControlled = controlledOpen !== undefined;
  const requestedOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange || setInternalOpen : setInternalOpen;
  const isDataReady = mode === "create" || (mode === "edit" && !!customer);
  const open = requestedOpen && isDataReady;
  const isEditing = mode === "edit" && customer !== null;

  const getDefaultValues = useCallback((): CustomerSheetFormValues => {
    if (isEditing && customer) {
      const sessionDuration = splitSessionMinutes(customer.session_minutes);

      return {
        email: customer.email || "",
        password: "",
        full_name: customer.full_name || "",
        gender: (customer.gender as "male" | "female" | "other") || "male",
        phone: customer.phone || "",
        birth_date: parseDatabaseDate(customer.birth_date) || new Date(),
        plan_id: localMembership?.plan_id.toString() || customer.plan_id?.toString() || "",
        final_price: localMembership?.price ?? customer.final_price ?? undefined,
        discount_amount: customer.discount_amount ?? 0,
        grace_days: normalizeGraceDays(customer.subscription_grace_days),
        date_mode: "automatic",
        payment_method: (customer.payment_method as "cash" | "card" | "transfer") || "cash",
        primary_goal: customer.primary_goal ?? undefined,
        secondary_goal: customer.secondary_goal ?? undefined,
        focus_areas: customer.focus_areas ?? [],
        experience_level: customer.experience_level ?? undefined,
        days_per_week: customer.days_per_week ? customer.days_per_week.toString() as CustomerSheetFormValues["days_per_week"] : undefined,
        session_hours: sessionDuration.hours,
        session_minutes_extra: sessionDuration.minutes,
        training_location: customer.training_location ?? DEFAULT_TRAINING_LOCATION,
        equipment_available:
          customer.equipment_available && customer.equipment_available.length > 0
            ? customer.equipment_available
            : DEFAULT_EQUIPMENT_AVAILABLE,
        cardio_preference: customer.cardio_preference ?? undefined,
        parq_requires_attention:
          customer.parq_requires_attention === true ? "yes" : customer.parq_requires_attention === false ? "no" : undefined,
        restricted_movements: customer.restricted_movements ?? [],
        exercise_preferences: customer.exercise_preferences || "",
        exercise_dislikes: customer.exercise_dislikes || "",
        injuries_or_pain: customer.injuries_or_pain || "",
        medical_clearance_notes: customer.medical_clearance_notes || "",
        injuries: customer.injuries || "",
        medical_notes: customer.medical_notes || "",
        weight_lb: kilogramsToPounds(customer.weight_kg) ?? undefined,
        height_cm: customer.height_cm ?? undefined,
        body_type: (customer.body_type as "ectomorph" | "mesomorph" | "endomorph") || undefined,
        diet_type: (customer.diet_type as "hipocalorica" | "normocalorica" | "hipercalorica") || undefined,
        activity_level:
          (customer.activity_level as "sedentario" | "1_3_dias" | "3_5_dias" | "6_7_dias" | "2_veces_dia") ||
          undefined,
        body_fat_percentage: customer.body_fat_percentage ?? undefined,
        muscle_mass_kg: customer.muscle_mass_kg ?? undefined,
        chest: customer.chest ?? undefined,
        waist: customer.waist ?? undefined,
        hip: customer.hip ?? undefined,
        arm_right: customer.arm_right ?? undefined,
        arm_left: customer.arm_left ?? undefined,
        leg_right: customer.leg_right ?? undefined,
        leg_left: customer.leg_left ?? undefined,
        subscription_period: {
          from: parseDatabaseDate(localMembership?.start_date || customer.subscription_start_date) || new Date(),
          to: parseDatabaseDate(localMembership?.end_date || customer.subscription_end_date) || new Date(),
        },
      };
    }
    return {
      email: "",
      password: "",
      full_name: "",
      gender: "male",
      phone: "",
      birth_date: new Date(),
      plan_id: "",
      discount_amount: 0,
      grace_days: DEFAULT_SUBSCRIPTION_GRACE_DAYS,
      date_mode: "automatic",
      payment_method: "cash",
      final_price: undefined,
      primary_goal: undefined,
      secondary_goal: undefined,
      focus_areas: [],
      experience_level: undefined,
      days_per_week: undefined,
      session_hours: 0,
      session_minutes_extra: 0,
      training_location: DEFAULT_TRAINING_LOCATION,
      equipment_available: DEFAULT_EQUIPMENT_AVAILABLE,
      cardio_preference: undefined,
      parq_requires_attention: undefined,
      restricted_movements: [],
      exercise_preferences: "",
      exercise_dislikes: "",
      injuries_or_pain: "",
      medical_clearance_notes: "",
      injuries: "",
      medical_notes: "",
      weight_lb: undefined,
      height_cm: undefined,
      diet_type: undefined,
      activity_level: undefined,
      body_fat_percentage: undefined,
      muscle_mass_kg: undefined,
      chest: undefined,
      waist: undefined,
      hip: undefined,
      arm_right: undefined,
      arm_left: undefined,
      leg_right: undefined,
      leg_left: undefined,
      body_type: undefined,
      subscription_period: {
        from: new Date(),
        to: new Date(),
      },
    };
  }, [isEditing, customer, localMembership]);

  const form = useForm<CustomerSheetFormValues>({
    resolver: zodResolver(customerSheetSchema) as Resolver<CustomerSheetFormValues>,
    defaultValues: getDefaultValues(),
  });
  const { reset, getValues, setValue, setError, clearErrors } = form;

  const priceContextRef = useRef<string | null>(null);
  const lastSuggestedFinalPriceRef = useRef<number | null>(null);
  const manualFinalPriceOverrideRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const values = getDefaultValues();
    reset(values);
    priceContextRef.current = null;
    lastSuggestedFinalPriceRef.current = null;
    manualFinalPriceOverrideRef.current = false;
    previousDateStateRef.current = {
      dateMode: values.date_mode,
      planId: values.plan_id || null,
      startTime: values.subscription_period?.from?.getTime() ?? null,
    };
  }, [open, customer, localMembership, getDefaultValues, reset]);

  const watchedPlanId = useWatch({ control: form.control, name: "plan_id" });
  const watchedDateMode = useWatch({ control: form.control, name: "date_mode" });
  const watchedSubscriptionStartDate = useWatch({ control: form.control, name: "subscription_period.from" });
  const watchedSubscriptionEndDate = useWatch({ control: form.control, name: "subscription_period.to" });
  const watchedDiscount = useWatch({ control: form.control, name: "discount_amount" });
  const watchedParqRequiresAttention = useWatch({ control: form.control, name: "parq_requires_attention" });
  const watchedWeightLb = useWatch({ control: form.control, name: "weight_lb" });
  const watchedHeight = useWatch({ control: form.control, name: "height_cm" });
  const watchedBodyType = useWatch({ control: form.control, name: "body_type" });
  const watchedDietType = useWatch({ control: form.control, name: "diet_type" });
  const watchedActivityLevel = useWatch({ control: form.control, name: "activity_level" });
  const watchedBirthDate = useWatch({ control: form.control, name: "birth_date" });
  const watchedGender = useWatch({ control: form.control, name: "gender" });
  const subscriptionPeriod = useWatch({ control: form.control, name: "subscription_period" });
  const watchedWeightKg = useMemo(() => poundsToKilograms(watchedWeightLb), [watchedWeightLb]);
  const selectedPlan = useMemo(() => plans.find((plan) => plan.id.toString() === watchedPlanId), [plans, watchedPlanId]);
  const selectedPlanPrice = selectedPlan?.price ?? 0;
  const membershipPricing = useMemo(
    () =>
      calculateMembershipPricing({
        planPrice: selectedPlan?.price,
        planDurationDays: selectedPlan?.duration_days,
        startDate: watchedSubscriptionStartDate,
        endDate: watchedSubscriptionEndDate,
        discountAmount: watchedDiscount,
      }),
    [selectedPlan?.duration_days, selectedPlan?.price, watchedDiscount, watchedSubscriptionEndDate, watchedSubscriptionStartDate],
  );
  const membershipPricingContextKey = useMemo(
    () =>
      buildMembershipPricingContextKey({
        planId: watchedPlanId,
        startDate: watchedSubscriptionStartDate,
        endDate: watchedSubscriptionEndDate,
        discountAmount: watchedDiscount,
      }),
    [watchedDiscount, watchedPlanId, watchedSubscriptionEndDate, watchedSubscriptionStartDate],
  );

  useEffect(() => {
    const startDate = watchedSubscriptionStartDate || getValues("subscription_period.from") || null;
    const currentState = {
      dateMode: watchedDateMode,
      planId: watchedPlanId || null,
      startTime: startDate?.getTime() ?? null,
    };
    const previousState = previousDateStateRef.current;

    if (watchedDateMode !== "automatic" || !watchedPlanId || !selectedPlan || !startDate) {
      previousDateStateRef.current = currentState;
      return;
    }

    const shouldRecalculate =
      previousState.dateMode !== "automatic" ||
      previousState.planId !== currentState.planId ||
      previousState.startTime !== currentState.startTime;

    if (shouldRecalculate) {
      setValue("subscription_period", {
        from: startDate,
        to: calculateSubscriptionEndDate(startDate, selectedPlan.duration_days),
      }, { shouldValidate: false });
    }

    previousDateStateRef.current = currentState;
  }, [watchedDateMode, watchedPlanId, watchedSubscriptionStartDate, selectedPlan, getValues, setValue]);

  useEffect(() => {
    if (!membershipPricing) {
      if (!selectedPlanPrice) {
        const currentFinalPrice = getValues("final_price");
        if (!areSameNumber(currentFinalPrice, 0)) {
          setValue("final_price", 0, { shouldValidate: false });
        }
      }
      return;
    }

    const currentFinalPrice = getValues("final_price");
    const contextChanged = priceContextRef.current !== membershipPricingContextKey;
    const shouldPreserveStoredCustomPrice =
      isEditing &&
      contextChanged &&
      priceContextRef.current === null &&
      !membershipPricing.isExactMultiple &&
      typeof currentFinalPrice === "number" &&
      currentFinalPrice > 0;

    if (membershipPricing.isExactMultiple) {
      manualFinalPriceOverrideRef.current = false;
      if (!areSameNumber(currentFinalPrice, membershipPricing.suggestedFinalPrice)) {
        setValue("final_price", membershipPricing.suggestedFinalPrice, { shouldValidate: false });
      }
    } else if (shouldPreserveStoredCustomPrice) {
      manualFinalPriceOverrideRef.current = true;
    } else {
      const matchesPreviousSuggestion =
        typeof currentFinalPrice === "number" &&
        lastSuggestedFinalPriceRef.current !== null &&
        Math.abs(currentFinalPrice - lastSuggestedFinalPriceRef.current) < 0.0001;

      if (
        contextChanged ||
        !manualFinalPriceOverrideRef.current ||
        currentFinalPrice === undefined ||
        currentFinalPrice === null ||
        matchesPreviousSuggestion
      ) {
        manualFinalPriceOverrideRef.current = false;
        if (!areSameNumber(currentFinalPrice, membershipPricing.suggestedFinalPrice)) {
          setValue("final_price", membershipPricing.suggestedFinalPrice, { shouldValidate: false });
        }
      }
    }

    lastSuggestedFinalPriceRef.current = membershipPricing.suggestedFinalPrice;
    priceContextRef.current = membershipPricingContextKey;

    if (Number(watchedDiscount) > membershipPricing.suggestedBasePrice && membershipPricing.suggestedBasePrice > 0) {
      setError("discount_amount", {
        type: "manual",
        message: `El descuento no puede ser mayor al precio calculado (Q${membershipPricing.suggestedBasePrice.toFixed(2)})`,
      });
      return;
    }

    clearErrors("discount_amount");
  }, [clearErrors, getValues, isEditing, membershipPricing, membershipPricingContextKey, selectedPlanPrice, setError, setValue, watchedDiscount]);

  useEffect(() => {
    if (watchedParqRequiresAttention !== "no") return;

    setValue("injuries_or_pain", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    setValue("medical_clearance_notes", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    clearErrors(["injuries_or_pain", "medical_clearance_notes"]);
  }, [clearErrors, setValue, watchedParqRequiresAttention]);

  const calculationPreview =
    watchedWeightKg &&
      watchedHeight &&
      watchedBodyType &&
      watchedDietType &&
      watchedActivityLevel &&
      watchedBirthDate &&
      watchedGender
      ? computeFitnessPlan({
        birthDate: watchedBirthDate,
        gender: watchedGender,
        weightKg: watchedWeightKg,
        heightCm: watchedHeight,
        bodyType: watchedBodyType,
        dietType: watchedDietType,
        activityLevel: watchedActivityLevel,
      })
      : null;

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (!range) return;
    const startDate = range.from || new Date();
    const currentDateMode = getValues("date_mode");
    const currentPlanId = getValues("plan_id");
    const currentPlan = plans.find((plan) => plan.id.toString() === currentPlanId);

    setValue("subscription_period", {
      from: startDate,
      to:
        currentDateMode === "automatic" && currentPlan
          ? calculateSubscriptionEndDate(startDate, currentPlan.duration_days)
          : range.to || startDate,
    });
  };

  const onSubmit = async (values: CustomerSheetFormValues) => {
    try {
      if (entrypoint === "customers") {
        const membershipPayload = buildBasicMembershipPayload(
          values,
          membershipPricing?.suggestedCycles,
        );

        if (isEditing && customer?.id) {
          const payload = buildPhaseAUpdatePayload(values, customer);

          if (!payload && (!membershipPayload || isSameBasicMembership(localMembership, membershipPayload))) {
            toast.info("No hay cambios básicos para guardar.");
            return;
          }

          if (payload) {
            await updateCustomerMutation({ id: customer.id, data: payload });
          }

          if (membershipPayload && !isSameBasicMembership(localMembership, membershipPayload)) {
            if (localMembership) {
              await renewMembershipForCustomer(customer.id, membershipPayload);
            } else {
              await createMembershipForCustomer(customer.id, membershipPayload);
            }
            await queryClient.invalidateQueries({ queryKey: ["memberships", "membership", customer.id] });
            await queryClient.invalidateQueries({ queryKey: ["customers", "detail", customer.id] });
            await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
            router.refresh();
          }
        } else {
          const payload = buildPhaseACreatePayload(values);
          if (membershipPayload) payload.membership = membershipPayload;
          await createCustomerMutation(payload);
        }

        setOpen(false);
        return;
      }

      setIsLegacySubmitting(true);
      const payload: CreateCustomerData = {
        email: values.email || undefined,
        origin: entrypoint,
        password: values.password || undefined,
        full_name: values.full_name,
        phone: values.phone,
        birth_date: values.birth_date,
        gender: values.gender,
        payment_method: values.payment_method,
        discount_amount: values.discount_amount,
        amount_original:
          values.final_price !== undefined
            ? Math.max(0, values.final_price + (Number(values.discount_amount) || 0))
            : membershipPricing?.suggestedBasePrice,
        grace_days: values.grace_days,
        plan_id: values.plan_id ? Number(values.plan_id) : undefined,
        final_price: values.final_price,
        start_date: values.subscription_period?.from,
        end_date: values.subscription_period?.to,
        primary_goal: values.primary_goal,
        secondary_goal: values.secondary_goal,
        focus_areas: values.focus_areas,
        experience_level: values.experience_level,
        days_per_week: values.days_per_week ? Number(values.days_per_week) : undefined,
        session_minutes: combineSessionDuration(values.session_hours, values.session_minutes_extra) ?? undefined,
        training_location: DEFAULT_TRAINING_LOCATION,
        equipment_available: values.equipment_available,
        cardio_preference: values.cardio_preference,
        parq_requires_attention:
          values.parq_requires_attention === "yes"
            ? true
            : values.parq_requires_attention === "no"
              ? false
              : undefined,
        restricted_movements: values.restricted_movements,
        exercise_preferences: normalizeTextFieldValue(values.exercise_preferences),
        exercise_dislikes: normalizeTextFieldValue(values.exercise_dislikes),
        injuries_or_pain:
          values.parq_requires_attention === "yes" ? normalizeTextFieldValue(values.injuries_or_pain) : "",
        medical_clearance_notes:
          values.parq_requires_attention === "yes" ? normalizeTextFieldValue(values.medical_clearance_notes) : "",
        weight_kg: poundsToKilograms(values.weight_lb) ?? undefined,
        height_cm: values.height_cm,
        diet_type: values.diet_type,
        activity_level: values.activity_level,
        body_fat_percentage: values.body_fat_percentage,
        muscle_mass_kg: values.muscle_mass_kg,
        chest: values.chest,
        waist: values.waist,
        hip: values.hip,
        arm_right: values.arm_right,
        arm_left: values.arm_left,
        leg_right: values.leg_right,
        leg_left: values.leg_left,
        injuries: normalizeTextFieldValue(values.injuries),
        body_type: values.body_type,
      };

      if (isEditing && customer?.id) {
        await updateLegacyCustomer(customer.id, payload);
      } else {
        await createLegacyCustomer(payload);
      }
      setOpen(false);
    } catch (error) {
      console.error("Submit error:", error);
    } finally {
      setIsLegacySubmitting(false);
    }
  };

  const reactivateCustomer = async () => {
    if (!customer?.id) return;
    await reactivateCustomerMutation(customer.id);
    setOpen(false);
  };

  return {
    open,
    setOpen,
    form,
    plans,
    isEditing,
    isPending,
    selectedPlanPrice,
    selectedPlanDurationDays: selectedPlan?.duration_days ?? null,
    membershipPricing,
    allowManualFinalPrice: Boolean(membershipPricing && !membershipPricing.isExactMultiple),
    markFinalPriceAsManual: () => {
      manualFinalPriceOverrideRef.current = true;
    },
    subscriptionPeriod,
    calculationPreview,
    onSubmit,
    handleDateRangeChange,
    reactivateCustomer,
  };
}

interface RenewAssessmentData {
  weight_kg: number;
  height_cm: number;
  body_type: string;
  diet_type?: string;
  activity_level?: string;
  body_fat_percentage?: number | null;
  muscle_mass?: number | null;
  chest_cm?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
  arm_right_cm?: number | null;
  arm_left_cm?: number | null;
  leg_right_cm?: number | null;
  leg_left_cm?: number | null;
  injuries?: string;
}

function getRenewSubscriptionDefaultValues(
  previousSubscriptionStartDate?: string | null,
  lastAssessment?: RenewAssessmentData | null,
  trainingProfile?: TrainingProfileInput | null,
): RenewSubscriptionFormValues {
  const sessionDuration = splitSessionMinutes(trainingProfile?.session_minutes);
  const renewalStartDate = calculateNextSubscriptionStartDate(parseDatabaseDate(previousSubscriptionStartDate));

  return {
    plan_id: "",
    date_mode: "automatic",
    subscription_period: {
      from: renewalStartDate,
      to: renewalStartDate,
    },
    price: 0,
    discount_amount: 0,
    grace_days: DEFAULT_SUBSCRIPTION_GRACE_DAYS,
    final_price: 0,
    payment_method: "cash",
    weight_lb: kilogramsToPounds(lastAssessment?.weight_kg) ?? undefined,
    height_cm: lastAssessment?.height_cm ?? undefined,
    body_type: toOptionalBodyType(lastAssessment?.body_type),
    diet_type: toOptionalDietType(lastAssessment?.diet_type),
    activity_level: toOptionalActivityLevel(trainingProfile?.activity_level ?? lastAssessment?.activity_level),
    body_fat_percentage: lastAssessment?.body_fat_percentage ?? undefined,
    muscle_mass_kg: lastAssessment?.muscle_mass ?? undefined,
    chest: lastAssessment?.chest_cm ?? undefined,
    waist: lastAssessment?.waist_cm ?? undefined,
    hip: lastAssessment?.hip_cm ?? undefined,
    arm_right: lastAssessment?.arm_right_cm ?? undefined,
    arm_left: lastAssessment?.arm_left_cm ?? undefined,
    leg_right: lastAssessment?.leg_right_cm ?? undefined,
    leg_left: lastAssessment?.leg_left_cm ?? undefined,
    injuries: lastAssessment?.injuries ?? "",
    primary_goal: trainingProfile?.primary_goal ?? undefined,
    secondary_goal: trainingProfile?.secondary_goal ?? undefined,
    focus_areas: trainingProfile?.focus_areas ?? [],
    experience_level: trainingProfile?.experience_level ?? undefined,
    days_per_week: trainingProfile?.days_per_week
      ? (trainingProfile.days_per_week.toString() as RenewSubscriptionFormValues["days_per_week"])
      : undefined,
    session_hours: trainingProfile?.session_minutes != null ? sessionDuration.hours : undefined,
    session_minutes_extra: trainingProfile?.session_minutes != null ? sessionDuration.minutes : undefined,
    training_location: trainingProfile?.training_location ?? undefined,
    equipment_available:
      trainingProfile?.equipment_available && trainingProfile.equipment_available.length > 0
        ? trainingProfile.equipment_available
        : [],
    cardio_preference: trainingProfile?.cardio_preference ?? undefined,
    parq_requires_attention:
      trainingProfile?.parq_requires_attention === true
        ? "yes"
        : trainingProfile?.parq_requires_attention === false
          ? "no"
          : undefined,
    restricted_movements: trainingProfile?.restricted_movements ?? [],
    exercise_preferences: trainingProfile?.exercise_preferences || "",
    exercise_dislikes: trainingProfile?.exercise_dislikes || "",
    injuries_or_pain: trainingProfile?.injuries_or_pain || "",
    medical_clearance_notes: trainingProfile?.medical_clearance_notes || "",
  };
}

interface UseHookFormRenewSubscriptionParams {
  customerId: string;
  customerGender?: "male" | "female" | "other" | null;
  customerBirthDate?: string | null;
  previousSubscriptionStartDate?: string | null;
  previousSubscriptionEndDate?: string | null;
  lastAssessment?: RenewAssessmentData | null;
  trainingProfile?: TrainingProfileInput | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  entrypoint?: "customers" | "cash";
}

export function useHookFormRenewSubscription({
  customerId,
  customerGender,
  customerBirthDate,
  previousSubscriptionStartDate,
  previousSubscriptionEndDate: _previousSubscriptionEndDate,
  lastAssessment,
  trainingProfile,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  entrypoint = "customers",
}: UseHookFormRenewSubscriptionParams) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  void _previousSubscriptionEndDate;
  const previousDateStateRef = useRef<{ dateMode?: RenewSubscriptionFormValues["date_mode"]; planId: string | null; startTime: number | null }>({
    dateMode: "automatic",
    planId: null,
    startTime: null,
  });
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange ?? setInternalOpen : setInternalOpen;
  const { data: plans = [] } = usePlans(true);

  const form = useForm<RenewSubscriptionFormValues>({
    resolver: zodResolver(renewSubscriptionSchema) as Resolver<RenewSubscriptionFormValues>,
    defaultValues: getRenewSubscriptionDefaultValues(previousSubscriptionStartDate, lastAssessment, trainingProfile),
  });
  const {
    reset: resetRenew,
    getValues: getRenewValues,
    setValue: setRenewValue,
    setError: setRenewError,
    clearErrors: clearRenewErrors,
  } = form;

  const priceContextRef = useRef<string | null>(null);
  const lastSuggestedFinalPriceRef = useRef<number | null>(null);
  const manualFinalPriceOverrideRef = useRef(false);

  const watchedPlanId = useWatch({ control: form.control, name: "plan_id" });
  const watchedDateMode = useWatch({ control: form.control, name: "date_mode" });
  const watchedSubscriptionStartDate = useWatch({ control: form.control, name: "subscription_period.from" });
  const watchedSubscriptionEndDate = useWatch({ control: form.control, name: "subscription_period.to" });
  const watchedDiscount = useWatch({ control: form.control, name: "discount_amount" });
  const watchedWeightLb = useWatch({ control: form.control, name: "weight_lb" });
  const watchedHeight = useWatch({ control: form.control, name: "height_cm" });
  const watchedBodyType = useWatch({ control: form.control, name: "body_type" });
  const watchedDietType = useWatch({ control: form.control, name: "diet_type" });
  const watchedActivity = useWatch({ control: form.control, name: "activity_level" });
  const watchedParqRequiresAttention = useWatch({ control: form.control, name: "parq_requires_attention" });
  const selectedPlan = useMemo(() => plans.find((plan) => plan.id.toString() === watchedPlanId), [plans, watchedPlanId]);
  const selectedPlanPrice = selectedPlan?.price ?? 0;
  const membershipPricing = useMemo(
    () =>
      calculateMembershipPricing({
        planPrice: selectedPlan?.price,
        planDurationDays: selectedPlan?.duration_days,
        startDate: watchedSubscriptionStartDate,
        endDate: watchedSubscriptionEndDate,
        discountAmount: watchedDiscount,
      }),
    [selectedPlan?.duration_days, selectedPlan?.price, watchedDiscount, watchedSubscriptionEndDate, watchedSubscriptionStartDate],
  );
  const membershipPricingContextKey = useMemo(
    () =>
      buildMembershipPricingContextKey({
        planId: watchedPlanId,
        startDate: watchedSubscriptionStartDate,
        endDate: watchedSubscriptionEndDate,
        discountAmount: watchedDiscount,
      }),
    [watchedDiscount, watchedPlanId, watchedSubscriptionEndDate, watchedSubscriptionStartDate],
  );
  const watchedWeightKg = useMemo(() => poundsToKilograms(watchedWeightLb), [watchedWeightLb]);

  const calculationPreview =
    watchedWeightKg &&
      watchedHeight &&
      watchedBodyType &&
      watchedDietType &&
      watchedActivity &&
      customerBirthDate &&
      customerGender
      ? computeFitnessPlan({
        birthDate: new Date(customerBirthDate),
        gender: customerGender,
        weightKg: watchedWeightKg,
        heightCm: watchedHeight,
        bodyType: watchedBodyType,
        dietType: watchedDietType,
        activityLevel: watchedActivity,
      })
      : null;

  useEffect(() => {
    if (!open) return;
    const values = getRenewSubscriptionDefaultValues(previousSubscriptionStartDate, lastAssessment, trainingProfile);
    resetRenew(values);
    priceContextRef.current = null;
    lastSuggestedFinalPriceRef.current = null;
    manualFinalPriceOverrideRef.current = false;
    previousDateStateRef.current = {
      dateMode: values.date_mode,
      planId: values.plan_id || null,
      startTime: values.subscription_period?.from?.getTime() ?? null,
    };
  }, [lastAssessment, open, previousSubscriptionStartDate, resetRenew, trainingProfile]);

  useEffect(() => {
    if (!membershipPricing) return;
    const currentPrice = getRenewValues("price");
    if (!areSameNumber(currentPrice, membershipPricing.suggestedBasePrice)) {
      setRenewValue("price", membershipPricing.suggestedBasePrice, { shouldValidate: false });
    }
  }, [getRenewValues, membershipPricing, setRenewValue]);

  useEffect(() => {
    const startDate = watchedSubscriptionStartDate || getRenewValues("subscription_period.from") || null;
    const currentState = {
      dateMode: watchedDateMode,
      planId: watchedPlanId || null,
      startTime: startDate?.getTime() ?? null,
    };
    const previousState = previousDateStateRef.current;

    if (watchedDateMode !== "automatic" || !watchedPlanId || !selectedPlan || !startDate) {
      previousDateStateRef.current = currentState;
      return;
    }

    const shouldRecalculate =
      previousState.dateMode !== "automatic" ||
      previousState.planId !== currentState.planId ||
      previousState.startTime !== currentState.startTime;

    if (shouldRecalculate) {
      setRenewValue("subscription_period", {
        from: startDate,
        to: calculateSubscriptionEndDate(startDate, selectedPlan.duration_days),
      }, { shouldValidate: false });
    }

    previousDateStateRef.current = currentState;
  }, [getRenewValues, selectedPlan, setRenewValue, watchedDateMode, watchedPlanId, watchedSubscriptionStartDate]);

  useEffect(() => {
    if (!membershipPricing) {
      if (!selectedPlanPrice) {
        const currentFinalPrice = getRenewValues("final_price");
        if (!areSameNumber(currentFinalPrice, 0)) {
          setRenewValue("final_price", 0, { shouldValidate: false });
        }
      }
      return;
    }

    const currentFinalPrice = getRenewValues("final_price");
    const contextChanged = priceContextRef.current !== membershipPricingContextKey;
    const shouldPreserveStoredCustomPrice =
      contextChanged &&
      priceContextRef.current === null &&
      !membershipPricing.isExactMultiple &&
      typeof currentFinalPrice === "number" &&
      currentFinalPrice > 0;

    if (membershipPricing.isExactMultiple) {
      manualFinalPriceOverrideRef.current = false;
      if (!areSameNumber(currentFinalPrice, membershipPricing.suggestedFinalPrice)) {
        setRenewValue("final_price", membershipPricing.suggestedFinalPrice, { shouldValidate: false });
      }
    } else if (shouldPreserveStoredCustomPrice) {
      manualFinalPriceOverrideRef.current = true;
    } else {
      const matchesPreviousSuggestion =
        typeof currentFinalPrice === "number" &&
        lastSuggestedFinalPriceRef.current !== null &&
        Math.abs(currentFinalPrice - lastSuggestedFinalPriceRef.current) < 0.0001;

      if (
        contextChanged ||
        !manualFinalPriceOverrideRef.current ||
        currentFinalPrice === undefined ||
        currentFinalPrice === null ||
        matchesPreviousSuggestion
      ) {
        manualFinalPriceOverrideRef.current = false;
        if (!areSameNumber(currentFinalPrice, membershipPricing.suggestedFinalPrice)) {
          setRenewValue("final_price", membershipPricing.suggestedFinalPrice, { shouldValidate: false });
        }
      }
    }

    lastSuggestedFinalPriceRef.current = membershipPricing.suggestedFinalPrice;
    priceContextRef.current = membershipPricingContextKey;

    if (Number(watchedDiscount) > membershipPricing.suggestedBasePrice && membershipPricing.suggestedBasePrice > 0) {
      setRenewError("discount_amount", {
        type: "manual",
        message: `El descuento no puede ser mayor al precio calculado (Q${membershipPricing.suggestedBasePrice.toFixed(2)})`,
      });
      return;
    }

    clearRenewErrors("discount_amount");
  }, [clearRenewErrors, getRenewValues, membershipPricing, membershipPricingContextKey, selectedPlanPrice, setRenewError, setRenewValue, watchedDiscount]);

  useEffect(() => {
    if (watchedParqRequiresAttention !== "no") return;

    setRenewValue("injuries_or_pain", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    setRenewValue("medical_clearance_notes", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    clearRenewErrors(["injuries_or_pain", "medical_clearance_notes"]);
  }, [clearRenewErrors, setRenewValue, watchedParqRequiresAttention]);

  const onSubmit = async (values: RenewSubscriptionFormValues) => {
    try {
      setLoading(true);
      const renewalPayload: Parameters<typeof renewSubscription>[1] = {
        origin: entrypoint,
        plan_id: Number(values.plan_id),
        start_date: values.subscription_period.from,
        end_date: values.subscription_period.to,
        price: values.price,
        discount_amount: values.discount_amount,
        grace_days: values.grace_days,
        amount_paid: values.final_price,
        payment_method: values.payment_method,
      };

      const weightKg = poundsToKilograms(values.weight_lb);
      if (weightKg != null) renewalPayload.weight_kg = weightKg;
      if (values.height_cm !== undefined) renewalPayload.height_cm = values.height_cm;
      if (values.body_type !== undefined) renewalPayload.body_type = values.body_type;
      if (values.diet_type !== undefined) renewalPayload.diet_type = values.diet_type;
      if (values.activity_level !== undefined) renewalPayload.activity_level = values.activity_level;
      if (values.body_fat_percentage !== undefined) renewalPayload.body_fat_percentage = values.body_fat_percentage;
      if (values.muscle_mass_kg !== undefined) renewalPayload.muscle_mass_kg = values.muscle_mass_kg;
      if (values.chest !== undefined) renewalPayload.chest = values.chest;
      if (values.waist !== undefined) renewalPayload.waist = values.waist;
      if (values.hip !== undefined) renewalPayload.hip = values.hip;
      if (values.arm_right !== undefined) renewalPayload.arm_right = values.arm_right;
      if (values.arm_left !== undefined) renewalPayload.arm_left = values.arm_left;
      if (values.leg_right !== undefined) renewalPayload.leg_right = values.leg_right;
      if (values.leg_left !== undefined) renewalPayload.leg_left = values.leg_left;

      const normalizedInjuries = normalizeTextFieldValue(values.injuries);
      if (hasMeaningfulText(normalizedInjuries) || lastAssessment?.injuries !== undefined) {
        renewalPayload.injuries = normalizedInjuries;
      }

      if (values.primary_goal !== undefined) renewalPayload.primary_goal = values.primary_goal;
      if (values.secondary_goal !== undefined) renewalPayload.secondary_goal = values.secondary_goal;
      if (values.focus_areas.length > 0) renewalPayload.focus_areas = values.focus_areas;
      if (values.experience_level !== undefined) renewalPayload.experience_level = values.experience_level;
      if (values.days_per_week) renewalPayload.days_per_week = Number(values.days_per_week);

      const sessionMinutes = combineSessionDuration(values.session_hours ?? 0, values.session_minutes_extra ?? 0);
      if (sessionMinutes !== null && sessionMinutes > 0) {
        renewalPayload.session_minutes = sessionMinutes;
      }

      if (values.training_location !== undefined) renewalPayload.training_location = values.training_location;
      if (values.equipment_available.length > 0) renewalPayload.equipment_available = values.equipment_available;
      if (values.cardio_preference !== undefined) renewalPayload.cardio_preference = values.cardio_preference;

      if (values.parq_requires_attention === "yes") {
        renewalPayload.parq_requires_attention = true;
      } else if (values.parq_requires_attention === "no") {
        renewalPayload.parq_requires_attention = false;
      }

      if (values.restricted_movements.length > 0) renewalPayload.restricted_movements = values.restricted_movements;

      const exercisePreferences = normalizeTextFieldValue(values.exercise_preferences);
      if (hasMeaningfulText(exercisePreferences)) renewalPayload.exercise_preferences = exercisePreferences;

      const exerciseDislikes = normalizeTextFieldValue(values.exercise_dislikes);
      if (hasMeaningfulText(exerciseDislikes)) renewalPayload.exercise_dislikes = exerciseDislikes;

      if (values.parq_requires_attention === "yes") {
        const injuriesOrPain = normalizeTextFieldValue(values.injuries_or_pain);
        if (hasMeaningfulText(injuriesOrPain)) renewalPayload.injuries_or_pain = injuriesOrPain;

        const medicalClearanceNotes = normalizeTextFieldValue(values.medical_clearance_notes);
        if (hasMeaningfulText(medicalClearanceNotes)) renewalPayload.medical_clearance_notes = medicalClearanceNotes;
      }

      const result = await renewSubscription(customerId, renewalPayload);

      if (result.success) {
        const deviceSync =
          typeof result === "object" && result !== null && "deviceSync" in result ? result.deviceSync : undefined;
        const deviceSynced = deviceSync?.attempted ? deviceSync.synced === true || deviceSync.queued === true : null;

        if (deviceSynced === false) {
          toast.warning("Suscripción renovada, pero falló la sincronización con el reloj.");
        } else if (deviceSynced === true) {
          toast.success("Suscripción renovada y acceso habilitado en el reloj.");
        } else {
          toast.success("Suscripción renovada exitosamente");
        }
        setOpen(false);
      } else {
        toast.error(result.error || "Error al renovar");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return {
    open,
    setOpen,
    form,
    plans,
    loading,
    selectedPlanPrice,
    selectedPlanDurationDays: selectedPlan?.duration_days ?? null,
    membershipPricing,
    allowManualFinalPrice: Boolean(membershipPricing && !membershipPricing.isExactMultiple),
    markFinalPriceAsManual: () => {
      manualFinalPriceOverrideRef.current = true;
    },
    calculationPreview,
    onSubmit,
  };
}
