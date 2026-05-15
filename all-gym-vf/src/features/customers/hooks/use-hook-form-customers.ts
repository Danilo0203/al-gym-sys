"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as z from "zod";
import { addDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { computeFitnessPlan } from "@/lib/fitness/excel-calculator";
import { kilogramsToPounds, poundsToKilograms } from "@/lib/fitness/measurements";
import type { ActivityLevel, BodyType, DietType } from "@/lib/fitness/types";
import { combineSessionDuration, DEFAULT_EQUIPMENT_AVAILABLE, DEFAULT_TRAINING_LOCATION, splitSessionMinutes } from "@/lib/training/profile-defaults";
import { usePlans } from "@/features/plans/hooks/use-plans";
import type { EquipmentOption, FocusArea, PrimaryGoal, RestrictedMovement, TrainingProfileInput, TrainingProfileStatus } from "@/lib/training/types";
import { renewSubscription, type CreateCustomerData } from "../actions/customer-actions";
import { useCreateCustomer, useReactivateCustomer, useUpdateCustomer } from "./use-customers";

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

const customerSheetSchema = z
  .object({
    email: z.string().email({ message: "Correo electrónico inválido" }),
    password: z.string().min(6, { message: "Mínimo 6 caracteres" }).optional().or(z.literal("")),
    full_name: z.string().min(2, { message: "El nombre es obligatorio" }),
    birth_date: z.date({ message: "La fecha de nacimiento es obligatoria" }),
    gender: z.enum(["male", "female", "other"], { message: "Selecciona el género" }),
    phone: z.string().regex(/^\d{8}$/, { message: "El teléfono debe tener exactamente 8 dígitos" }),
    plan_id: z.string().optional(),
    final_price: z.number().optional(),
    discount_amount: z.coerce.number().min(0).default(0),
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
    body_type: z.enum(["ectomorph", "mesomorph", "endomorph"]).optional(),
  })
  .superRefine((value, ctx) => {
    const sessionMinutes = combineSessionDuration(value.session_hours, value.session_minutes_extra);
    if (sessionMinutes !== null && sessionMinutes > 480) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["session_hours"],
        message: "La duración por sesión no puede superar 8 horas.",
      });
    }

    if (value.parq_requires_attention === "yes" && !normalizeTextFieldValue(value.injuries_or_pain)) {
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
    final_price: z.number(),
    payment_method: z.enum(["cash", "card", "transfer"]),
    weight_lb: z.coerce.number().positive("El peso debe ser mayor a 0"),
    height_cm: z.coerce.number().positive("La estatura debe ser mayor a 0"),
    body_type: z.enum(["ectomorph", "mesomorph", "endomorph"]),
    diet_type: z.enum(["hipocalorica", "normocalorica", "hipercalorica"]),
    activity_level: z.enum(["sedentario", "1_3_dias", "3_5_dias", "6_7_dias", "2_veces_dia"]),
    body_fat_percentage: z.coerce.number().min(1, "Ingresa % grasa").max(100),
    muscle_mass_kg: z.coerce.number().positive("Ingresa masa muscular"),
    chest: z.coerce.number().positive("Ingresa pecho"),
    waist: z.coerce.number().positive("Ingresa cintura"),
    hip: z.coerce.number().positive("Ingresa cadera"),
    arm_right: z.coerce.number().positive("Ingresa brazo derecho"),
    arm_left: z.coerce.number().positive("Ingresa brazo izquierdo"),
    leg_right: z.coerce.number().positive("Ingresa pierna derecha"),
    leg_left: z.coerce.number().positive("Ingresa pierna izquierda"),
    injuries: z.string().optional().or(z.literal("")),
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
  })
  .superRefine((value, ctx) => {
    const sessionMinutes = combineSessionDuration(value.session_hours, value.session_minutes_extra);
    if (sessionMinutes !== null && sessionMinutes > 480) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["session_hours"],
        message: "La duración por sesión no puede superar 8 horas.",
      });
    }

    if (value.parq_requires_attention === "yes" && !normalizeTextFieldValue(value.injuries_or_pain)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["injuries_or_pain"],
        message: "Explica por qué requiere atención antes de entrenar.",
      });
    }
  });

function toBodyType(value?: string | null): BodyType {
  if (value === "ectomorph" || value === "mesomorph" || value === "endomorph") return value;
  return "mesomorph";
}

function toDietType(value?: string | null): DietType {
  if (value === "hipocalorica" || value === "normocalorica" || value === "hipercalorica") return value;
  return "normocalorica";
}

function toActivityLevel(value?: string | null): ActivityLevel {
  if (value === "sedentario" || value === "1_3_dias" || value === "3_5_dias" || value === "6_7_dias" || value === "2_veces_dia") {
    return value;
  }
  return "3_5_dias";
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

function normalizeTextFieldValue(value?: string | null) {
  if (typeof value !== "string") return "";
  return value.trim();
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
  discount_amount?: number | null;
  final_price?: number | null;
  payment_method?: string | null;
  training_profile_status?: TrainingProfileStatus | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  injuries?: string | null;
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
  const [internalOpen, setInternalOpen] = useState(false);
  const userModifiedDatesRef = useRef(false);
  const previousPlanId = useRef<string | null>(null);
  const { data: plans = [] } = usePlans(true);
  const { mutateAsync: createCustomerMutation, isPending: isCreating } = useCreateCustomer();
  const { mutateAsync: updateCustomerMutation, isPending: isUpdating } = useUpdateCustomer();
  const { mutateAsync: reactivateCustomerMutation } = useReactivateCustomer();
  const isPending = isCreating || isUpdating;
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
        plan_id: customer.plan_id?.toString() || "",
        final_price: customer.final_price ?? undefined,
        discount_amount: customer.discount_amount ?? 0,
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
          from: parseDatabaseDate(customer.subscription_start_date) || new Date(),
          to: parseDatabaseDate(customer.subscription_end_date) || new Date(),
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
  }, [isEditing, customer]);

  const form = useForm<CustomerSheetFormValues>({
    resolver: zodResolver(customerSheetSchema) as Resolver<CustomerSheetFormValues>,
    defaultValues: getDefaultValues(),
  });

  useEffect(() => {
    if (!open) return;
    const values = getDefaultValues();
    form.reset(values);
    userModifiedDatesRef.current = false;
    previousPlanId.current = customer?.plan_id?.toString() || null;
  }, [open, customer, form, getDefaultValues]);

  const watchedPlanId = useWatch({ control: form.control, name: "plan_id" });
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
  const selectedPlanPrice = useMemo(() => {
    const selectedPlan = plans.find((plan) => plan.id.toString() === watchedPlanId);
    return selectedPlan?.price ?? 0;
  }, [plans, watchedPlanId]);

  useEffect(() => {
    if (!watchedPlanId) return;
    const planChanged = previousPlanId.current !== watchedPlanId;
    previousPlanId.current = watchedPlanId;
    const selectedPlan = plans.find((plan) => plan.id.toString() === watchedPlanId);

    if (!selectedPlan) return;
    if (planChanged && !userModifiedDatesRef.current) {
      const startDate = form.getValues("subscription_period.from") || new Date();
      const endDate = addDays(startDate, selectedPlan.duration_days);
      form.setValue("subscription_period", {
        from: startDate,
        to: endDate,
      });
    }
  }, [watchedPlanId, plans, form]);

  useEffect(() => {
    const discount = Number(watchedDiscount) || 0;
    const finalPrice = Math.max(0, selectedPlanPrice - discount);
    form.setValue("final_price", finalPrice, { shouldValidate: false });

    if (discount > selectedPlanPrice && selectedPlanPrice > 0) {
      form.setError("discount_amount", {
        type: "manual",
        message: `El descuento no puede ser mayor al precio del plan (Q${selectedPlanPrice.toFixed(2)})`,
      });
      return;
    }

    form.clearErrors("discount_amount");
  }, [selectedPlanPrice, watchedDiscount, form]);

  useEffect(() => {
    if (watchedParqRequiresAttention !== "no") return;

    form.setValue("injuries_or_pain", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue("medical_clearance_notes", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.clearErrors(["injuries_or_pain", "medical_clearance_notes"]);
  }, [form, watchedParqRequiresAttention]);

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
    userModifiedDatesRef.current = true;
    form.setValue("subscription_period", {
      from: range.from || new Date(),
      to: range.to || range.from || new Date(),
    });
  };

  const onSubmit = async (values: CustomerSheetFormValues) => {
    try {
      const payload: CreateCustomerData = {
        email: values.email,
        origin: entrypoint,
        password: values.password || undefined,
        full_name: values.full_name,
        phone: values.phone,
        birth_date: values.birth_date,
        gender: values.gender,
        payment_method: values.payment_method,
        discount_amount: values.discount_amount,
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
        await updateCustomerMutation({ id: customer.id, data: payload });
      } else {
        await createCustomerMutation(payload);
      }
      setOpen(false);
    } catch (error) {
      console.error("Submit error:", error);
    }
  };

  const reactivateCustomer = async () => {
    if (!customer?.id) return;
    const result = await reactivateCustomerMutation(customer.id);
    if (result.success) {
      setOpen(false);
    }
  };

  return {
    open,
    setOpen,
    form,
    plans,
    isEditing,
    isPending,
    selectedPlanPrice,
    subscriptionPeriod,
    calculationPreview,
    onSubmit,
    handleDateRangeChange,
    markDatesAsModified: () => {
      userModifiedDatesRef.current = true;
    },
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
  lastAssessment?: RenewAssessmentData | null,
  trainingProfile?: TrainingProfileInput | null,
): RenewSubscriptionFormValues {
  const sessionDuration = splitSessionMinutes(trainingProfile?.session_minutes);

  return {
    plan_id: "",
    subscription_period: {
      from: new Date(),
      to: new Date(),
    },
    price: 0,
    discount_amount: 0,
    final_price: 0,
    payment_method: "cash",
    weight_lb: kilogramsToPounds(lastAssessment?.weight_kg) || 0,
    height_cm: lastAssessment?.height_cm || 0,
    body_type: toBodyType(lastAssessment?.body_type),
    diet_type: toDietType(lastAssessment?.diet_type),
    activity_level: toActivityLevel(trainingProfile?.activity_level ?? lastAssessment?.activity_level),
    body_fat_percentage: lastAssessment?.body_fat_percentage || 0,
    muscle_mass_kg: lastAssessment?.muscle_mass || 0,
    chest: lastAssessment?.chest_cm || 0,
    waist: lastAssessment?.waist_cm || 0,
    hip: lastAssessment?.hip_cm || 0,
    arm_right: lastAssessment?.arm_right_cm || 0,
    arm_left: lastAssessment?.arm_left_cm || 0,
    leg_right: lastAssessment?.leg_right_cm || 0,
    leg_left: lastAssessment?.leg_left_cm || 0,
    injuries: lastAssessment?.injuries || "",
    primary_goal: trainingProfile?.primary_goal ?? undefined,
    secondary_goal: trainingProfile?.secondary_goal ?? undefined,
    focus_areas: trainingProfile?.focus_areas ?? [],
    experience_level: trainingProfile?.experience_level ?? undefined,
    days_per_week: trainingProfile?.days_per_week
      ? (trainingProfile.days_per_week.toString() as RenewSubscriptionFormValues["days_per_week"])
      : undefined,
    session_hours: sessionDuration.hours,
    session_minutes_extra: sessionDuration.minutes,
    training_location: trainingProfile?.training_location ?? DEFAULT_TRAINING_LOCATION,
    equipment_available:
      trainingProfile?.equipment_available && trainingProfile.equipment_available.length > 0
        ? trainingProfile.equipment_available
        : DEFAULT_EQUIPMENT_AVAILABLE,
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
  lastAssessment,
  trainingProfile,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  entrypoint = "customers",
}: UseHookFormRenewSubscriptionParams) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const userModifiedDatesRef = useRef(false);
  const previousPlanId = useRef<string | null>(null);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange ?? setInternalOpen : setInternalOpen;
  const { data: plans = [] } = usePlans(true);

  const form = useForm<RenewSubscriptionFormValues>({
    resolver: zodResolver(renewSubscriptionSchema) as Resolver<RenewSubscriptionFormValues>,
    defaultValues: getRenewSubscriptionDefaultValues(lastAssessment, trainingProfile),
  });

  const watchedPlanId = useWatch({ control: form.control, name: "plan_id" });
  const watchedDiscount = useWatch({ control: form.control, name: "discount_amount" });
  const watchedWeightLb = useWatch({ control: form.control, name: "weight_lb" });
  const watchedHeight = useWatch({ control: form.control, name: "height_cm" });
  const watchedBodyType = useWatch({ control: form.control, name: "body_type" });
  const watchedDietType = useWatch({ control: form.control, name: "diet_type" });
  const watchedActivity = useWatch({ control: form.control, name: "activity_level" });
  const watchedParqRequiresAttention = useWatch({ control: form.control, name: "parq_requires_attention" });
  const selectedPlanPrice = useMemo(() => {
    const selectedPlan = plans.find((plan) => plan.id.toString() === watchedPlanId);
    return selectedPlan?.price ?? 0;
  }, [plans, watchedPlanId]);
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
    form.reset(getRenewSubscriptionDefaultValues(lastAssessment, trainingProfile));
    userModifiedDatesRef.current = false;
    previousPlanId.current = null;
  }, [open, lastAssessment, trainingProfile, form]);

  useEffect(() => {
    if (!watchedPlanId) return;
    const planChanged = previousPlanId.current !== watchedPlanId;
    previousPlanId.current = watchedPlanId;
    const selectedPlan = plans.find((plan) => plan.id.toString() === watchedPlanId);
    if (!selectedPlan) return;

    form.setValue("price", selectedPlan.price);

    if (planChanged && !userModifiedDatesRef.current) {
      const startDate = form.getValues("subscription_period.from") || new Date();
      const endDate = addDays(startDate, selectedPlan.duration_days);
      form.setValue("subscription_period", {
        from: startDate,
        to: endDate,
      });
    }
  }, [watchedPlanId, plans, form]);

  useEffect(() => {
    const discount = Number(watchedDiscount) || 0;
    const finalPrice = Math.max(0, selectedPlanPrice - discount);
    form.setValue("final_price", finalPrice);
  }, [selectedPlanPrice, watchedDiscount, form]);

  useEffect(() => {
    if (watchedParqRequiresAttention !== "no") return;

    form.setValue("injuries_or_pain", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue("medical_clearance_notes", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.clearErrors(["injuries_or_pain", "medical_clearance_notes"]);
  }, [form, watchedParqRequiresAttention]);

  const onSubmit = async (values: RenewSubscriptionFormValues) => {
    try {
      setLoading(true);
      const result = await renewSubscription(customerId, {
        origin: entrypoint,
        plan_id: Number(values.plan_id),
        start_date: values.subscription_period.from,
        end_date: values.subscription_period.to,
        price: values.price,
        discount_amount: values.discount_amount,
        amount_paid: values.final_price,
        payment_method: values.payment_method,
        weight_kg: poundsToKilograms(values.weight_lb) ?? 0,
        height_cm: values.height_cm,
        body_type: values.body_type,
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
      });

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
    calculationPreview,
    onSubmit,
    markDatesAsModified: () => {
      userModifiedDatesRef.current = true;
    },
  };
}
