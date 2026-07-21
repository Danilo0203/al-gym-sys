"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Controller } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormCheckboxGroup } from "@/components/forms/form-checkbox-group";
import { FlexibleDatePickerInput } from "@/components/forms/flexible-date-picker-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormInputGroup } from "@/components/forms/form-input-group";
import { FormRadioGroup } from "@/components/forms/form-radio-group";
import { FormTextarea } from "@/components/forms/form-textarea";
import {
  IconDiscount,
  IconScale,
  IconRuler,
  IconCheck,
  IconLoader2,
  IconRefresh,
} from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { differenceInDays } from "date-fns";
import { calculateSubscriptionEndDate, useHookFormRenewSubscription } from "../hooks/use-hook-form-customers";
import {
  CARDIO_PREFERENCE_OPTIONS,
  DAYS_PER_WEEK_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  FOCUS_AREA_OPTIONS,
  PRIMARY_GOAL_OPTIONS,
  RESTRICTED_MOVEMENT_OPTIONS,
} from "@/lib/training/options";
import type { TrainingProfileInput } from "@/lib/training/types";
// TIPO DE DATOS DEL SHEET
interface RenewSubscriptionSheetProps {
  customerId: string;
  customerName: string;
  customerGender?: "male" | "female" | "other" | null;
  customerBirthDate?: string | null;
  previousSubscriptionStartDate?: string | null;
  previousSubscriptionEndDate?: string | null;
  lastAssessment?: {
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
  } | null;
  trainingProfile?: TrainingProfileInput | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  entrypoint?: "customers" | "cash";
  legacyRenewSubscription?: (
    customerId: string,
    payload: Record<string, unknown>,
  ) => Promise<{
    success: boolean;
    error?: string;
    deviceSync?: { attempted?: boolean; synced?: boolean; queued?: boolean };
  }>;
}

export function RenewSubscriptionSheet({
  customerId,
  customerName,
  customerGender,
  customerBirthDate,
  previousSubscriptionStartDate,
  previousSubscriptionEndDate,
  lastAssessment,
  trainingProfile,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  entrypoint = "customers",
  legacyRenewSubscription,
}: RenewSubscriptionSheetProps) {
  const {
    open,
    setOpen,
    form,
    plans,
    loading,
    selectedPlanPrice,
    selectedPlanDurationDays,
    membershipPricing,
    allowManualFinalPrice,
    markFinalPriceAsManual,
    calculationPreview,
    onSubmit,
  } =
    useHookFormRenewSubscription({
      customerId,
      customerGender,
      customerBirthDate,
      previousSubscriptionStartDate,
      previousSubscriptionEndDate,
      lastAssessment,
      trainingProfile,
      open: controlledOpen,
      onOpenChange: controlledOnOpenChange,
      entrypoint,
      legacyRenewSubscription,
    });

  const showAttentionDetails = form.watch("parq_requires_attention") === "yes";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>
      ) : (
        <SheetTrigger asChild>
          <Button>
            <IconRefresh className="mr-2 h-4 w-4" />
            Renovar Suscripción
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="sm:max-w-xl w-full flex flex-col h-full p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b space-y-1 sticky top-0 bg-background/80 backdrop-blur-md z-10">
          <SheetTitle>{entrypoint === "cash" ? `Renovar y cobrar: ${customerName}` : `Renovar Suscripción: ${customerName}`}</SheetTitle>
          <SheetDescription>
            {entrypoint === "cash"
              ? "Completa la renovación dentro de la sesión de caja actual y confirma el cobro."
              : "Completa los detalles de la renovación y actualiza la ficha médica si es necesario."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 font-sans">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-4">
              {/* SECCIÓN 1: MEMBRESÍA */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    1
                  </span>
                  Membresía
                </h4>
                <div className="space-y-4 pl-4">
                  {/* Selección de Plan */}
                  <FormSelect
                    control={form.control}
                    name="plan_id"
                    label="Seleccionar Plan"
                    placeholder="Elige un plan..."
                    options={plans.map((p) => ({
                      label: `${p.name} - Q${p.price} (${p.duration_days} días)`,
                      value: p.id.toString(),
                    }))}
                  />

                  <FormRadioGroup
                    control={form.control}
                    name="date_mode"
                    label="Modo de Fecha"
                    orientation="horizontal"
                    options={[
                      { label: "Fecha automática", value: "automatic" },
                      { label: "Fecha manual", value: "manual" },
                    ]}
                  />

                  {/* CALENDARIO DE RANGO */}
                  <Controller
                    control={form.control}
                    name="subscription_period"
                    render={({ field, fieldState }) => {
                      const from = field.value?.from;
                      const to = field.value?.to;
                      const daysDiff = from && to ? differenceInDays(to, from) : 0;

                      // Handlers for individual date inputs
                      const handleStartChange = (date?: Date) => {
                        const startDate = date || new Date();
                        const dateMode = form.getValues("date_mode");
                        const selectedPlanId = form.getValues("plan_id");
                        const selectedPlan = plans.find((plan) => plan.id.toString() === selectedPlanId);

                        form.setValue("subscription_period", {
                          from: startDate,
                          to:
                            dateMode === "automatic" && selectedPlan
                              ? calculateSubscriptionEndDate(startDate, selectedPlan.duration_days)
                              : field.value?.to || startDate,
                        });
                      };

                      const handleEndChange = (date?: Date) => {
                        form.setValue("subscription_period", {
                          from: field.value?.from || new Date(),
                          to: date || new Date(),
                        });
                      };

                      return (
                        <Field className="flex flex-col" data-invalid={fieldState.invalid}>
                          <FieldLabel>Vigencia de Suscripción</FieldLabel>
                          <div className="grid grid-cols-[1fr_1fr_auto_80px] gap-2 items-center">
                            {/* Fecha Inicio */}
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Inicio</span>
                              <FlexibleDatePickerInput
                                value={from}
                                onChange={handleStartChange}
                                endMonth={new Date(new Date().getFullYear() + 10, 11)}
                              />
                            </div>

                            {/* Fecha Fin */}
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Fin</span>
                              <FlexibleDatePickerInput
                                value={to}
                                onChange={handleEndChange}
                                endMonth={new Date(new Date().getFullYear() + 10, 11)}
                              />
                            </div>

                            {/* Días */}
                            <div className="flex flex-col gap-1 mt-5">
                              <div className="h-9 flex items-center justify-center px-2 border rounded-md bg-muted text-muted-foreground font-medium text-sm">
                                {daysDiff} días
                              </div>
                            </div>
                          </div>
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      );
                    }}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInputGroup
                      control={form.control}
                      name="grace_days"
                      label="Prorroga"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="3"
                    />
                  </div>

                  {/* Cálculos de Precio */}
                  <div className="grid grid-cols-3 gap-4 items-end bg-muted/30 p-3 rounded-md">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted-foreground">Precio Plan</label>
                      <div className="h-10 flex items-center px-3 border rounded-md bg-muted text-muted-foreground font-semibold">
                        Q{selectedPlanPrice.toFixed(2)}
                      </div>
                    </div>

                    <FormInputGroup
                      control={form.control}
                      name="discount_amount"
                      label="Descuento"
                      type="number"
                      min={0}
                      placeholder="0.00"
                      icon={<IconDiscount className="h-4 w-4" />}
                    />

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-primary">Precio Final</label>
                      <Controller
                        control={form.control}
                        name="final_price"
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-sm font-bold">Q</span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 pl-7 py-2 text-sm font-bold text-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!allowManualFinalPrice}
                                value={field.value ?? ""}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  markFinalPriceAsManual();
                                  field.onChange(value === "" ? undefined : Number.parseFloat(value));
                                }}
                              />
                            </div>
                            <FieldError errors={[fieldState.error]} />
                          </Field>
                        )}
                      />
                    </div>
                  </div>

                  {allowManualFinalPrice && membershipPricing && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      La duración seleccionada ({membershipPricing.selectedDays} días) no coincide exactamente con el plan
                      {selectedPlanDurationDays ? ` de ${selectedPlanDurationDays} días` : ""}. El sistema sugiere cobrar
                      {" "}<span className="font-semibold">Q{membershipPricing.suggestedFinalPrice.toFixed(2)}</span>
                      {" "}({membershipPricing.suggestedCycles} períodos), pero puedes modificar el monto final a tu gusto.
                    </p>
                  )}

                  <FormSelect
                    control={form.control}
                    name="payment_method"
                    label="Método de Pago"
                    options={[
                      { label: "Efectivo", value: "cash" },
                      { label: "Tarjeta", value: "card" },
                      { label: "Transferencia", value: "transfer" },
                    ]}
                  />
                </div>
              </div>

              <Separator />

              {/* SECCIÓN 2: FICHA MÉDICA */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    2
                  </span>
                  Ficha Médica
                </h4>
                <div className="space-y-4 pl-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormInputGroup
                      control={form.control}
                      name="weight_lb"
                      label="Peso (lb)"
                      type="number"
                      icon={<IconScale className="h-4 w-4" />}
                    />
                    <FormInputGroup
                      control={form.control}
                      name="height_cm"
                      label="Estatura (cm)"
                      type="number"
                      icon={<IconRuler className="h-4 w-4" />}
                    />
                  </div>

                  <FormSelect
                    control={form.control}
                    name="body_type"
                    label="Somatotipo"
                    options={[
                      { label: "Ectomorfo", value: "ectomorph" },
                      { label: "Mesomorfo", value: "mesomorph" },
                      { label: "Endomorfo", value: "endomorph" },
                    ]}
                  />

                  <div className="grid grid-cols-2 gap-4">
                  <FormSelect
                    control={form.control}
                    name="diet_type"
                    label="Tipo de dieta"
                    required
                    options={[
                      { label: "Hipocalórica", value: "hipocalorica" },
                      { label: "Normocalórica", value: "normocalorica" },
                      { label: "Hipercalórica", value: "hipercalorica" },
                      ]}
                    />
                    <FormSelect
                      control={form.control}
                      name="activity_level"
                      label="Nivel de actividad"
                      required
                      options={[
                        { label: "Poco o nada", value: "sedentario" },
                        { label: "1 a 3 días/semana", value: "1_3_dias" },
                        { label: "3 a 5 días/semana", value: "3_5_dias" },
                        { label: "6 a 7 días/semana", value: "6_7_dias" },
                        { label: "2 veces al día", value: "2_veces_dia" },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormInputGroup
                      control={form.control}
                      name="body_fat_percentage"
                      label="% Grasa"
                      type="number"
                      required
                    />
                    <FormInputGroup
                      control={form.control}
                      name="muscle_mass_kg"
                      label="Masa Muscular (kg)"
                      type="number"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormInputGroup control={form.control} name="chest" label="Pecho (cm)" type="number" required />
                    <FormInputGroup control={form.control} name="waist" label="Cintura (cm)" type="number" required />
                    <FormInputGroup control={form.control} name="hip" label="Cadera (cm)" type="number" required />
                    <FormInputGroup control={form.control} name="arm_right" label="Brazo Der. (cm)" type="number" required />
                    <FormInputGroup control={form.control} name="arm_left" label="Brazo Izq. (cm)" type="number" required />
                    <FormInputGroup control={form.control} name="leg_right" label="Pierna Der. (cm)" type="number" required />
                    <FormInputGroup control={form.control} name="leg_left" label="Pierna Izq. (cm)" type="number" required />
                  </div>

                  <FormTextarea
                    control={form.control}
                    name="injuries"
                    label="Observaciones / Lesiones"
                    placeholder="Describe cualquier lesión o condición física relevante..."
                  />

                  {calculationPreview && (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                      <p className="font-medium mb-1">Vista previa cálculo</p>
                      <p>Calorías: {calculationPreview.dailyCalories} kcal</p>
                      <p>
                        Macros (P/C/G): {calculationPreview.proteinGrams}/{calculationPreview.carbsGrams}/
                        {calculationPreview.fatGrams} g
                      </p>
                      <p>Agua: {calculationPreview.waterLitersGoal} L</p>
                      <p>Cardio: {calculationPreview.cardioMinutes} min</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    3
                  </span>
                  Perfil de Entrenamiento
                </h4>
                <div className="space-y-4 pl-4">
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                    <div className="space-y-1">
                      <h5 className="text-sm font-semibold">Objetivo</h5>
                      <p className="text-xs text-muted-foreground">
                        Se carga el perfil actual para que puedas ajustarlo si cambió la meta o la rutina del cliente.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormSelect
                        control={form.control}
                        name="primary_goal"
                        label="Objetivo principal"
                        placeholder="Seleccionar objetivo..."
                        options={PRIMARY_GOAL_OPTIONS}
                      />
                      <FormSelect
                        control={form.control}
                        name="secondary_goal"
                        label="Objetivo secundario"
                        placeholder="Opcional"
                        options={PRIMARY_GOAL_OPTIONS}
                      />
                    </div>
                    <FormCheckboxGroup
                      control={form.control}
                      name="focus_areas"
                      label="Áreas de enfoque"
                      description="Opcional. Ayuda a priorizar grupos musculares dentro de la rutina."
                      options={FOCUS_AREA_OPTIONS}
                      columns={3}
                    />
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                    <div className="space-y-1">
                      <h5 className="text-sm font-semibold">Salud y restricciones</h5>
                      <p className="text-xs text-muted-foreground">
                        Úsalo cuando el cliente cambió de condición, se lesionó o necesita adaptar su entrenamiento.
                      </p>
                    </div>
                    <FormRadioGroup
                      control={form.control}
                      name="parq_requires_attention"
                      label="¿Necesita revisión médica o atención especial antes de entrenar?"
                      options={[
                        { label: "Sí, requiere atención", value: "yes" },
                        { label: "No, puede entrenar normal", value: "no" },
                      ]}
                      orientation="vertical"
                    />
                    {showAttentionDetails ? (
                      <>
                        <FormTextarea
                          control={form.control}
                          name="injuries_or_pain"
                          label="¿Por qué requiere atención?"
                          placeholder="Ejemplo: molestia en rodilla derecha al hacer sentadillas profundas."
                          config={{ rows: 3, maxLength: 240 }}
                        />
                        <FormTextarea
                          control={form.control}
                          name="medical_clearance_notes"
                          label="Notas de autorización médica"
                          placeholder="Opcional. Indicaciones médicas, observaciones o restricciones clínicas."
                          config={{ rows: 3, maxLength: 240 }}
                        />
                      </>
                    ) : null}
                    <FormCheckboxGroup
                      control={form.control}
                      name="restricted_movements"
                      label="Movimientos a evitar o limitar"
                      options={RESTRICTED_MOVEMENT_OPTIONS}
                      showBadges={false}
                      columns={2}
                    />
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                    <div className="space-y-1">
                      <h5 className="text-sm font-semibold">Preferencias de entrenamiento</h5>
                      <p className="text-xs text-muted-foreground">
                        Esto ayuda a regenerar o ajustar la rutina con el contexto correcto.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormSelect
                        control={form.control}
                        name="experience_level"
                        label="Nivel de experiencia"
                        placeholder="Seleccionar..."
                        options={EXPERIENCE_LEVEL_OPTIONS}
                      />
                      <FormSelect
                        control={form.control}
                        name="days_per_week"
                        label="Días por semana"
                        placeholder="Seleccionar..."
                        options={DAYS_PER_WEEK_OPTIONS}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <h6 className="text-sm font-medium">Duración por sesión</h6>
                        <p className="text-xs text-muted-foreground">Define la sesión usando horas y minutos.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormInputGroup
                          control={form.control}
                          name="session_hours"
                          label="Horas"
                          type="number"
                          min={0}
                          max={8}
                          placeholder="1"
                        />
                        <FormInputGroup
                          control={form.control}
                          name="session_minutes_extra"
                          label="Minutos"
                          type="number"
                          min={0}
                          max={59}
                          placeholder="30"
                        />
                      </div>
                    </div>
                    <FormRadioGroup
                      control={form.control}
                      name="cardio_preference"
                      label="Preferencia de cardio"
                      options={CARDIO_PREFERENCE_OPTIONS}
                      orientation="vertical"
                    />
                    <FormCheckboxGroup
                      control={form.control}
                      name="equipment_available"
                      label="Equipo disponible"
                      description="Selecciona lo que realmente tiene a mano el cliente."
                      options={EQUIPMENT_OPTIONS}
                      showBadges={false}
                      columns={3}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormTextarea
                        control={form.control}
                        name="exercise_preferences"
                        label="Preferencias"
                        placeholder="Ejemplo: le gustan máquinas, caminadora y superseries."
                        config={{ rows: 3, maxLength: 220 }}
                      />
                      <FormTextarea
                        control={form.control}
                        name="exercise_dislikes"
                        label="Ejercicios o formatos que evita"
                        placeholder="Ejemplo: no le gustan burpees ni ejercicios muy técnicos."
                        config={{ rows: 3, maxLength: 220 }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </form>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-background/80 backdrop-blur-md z-10">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            onClick={form.handleSubmit(onSubmit)}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Renovación <IconCheck className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
