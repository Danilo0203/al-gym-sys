"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Controller } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormInputGroup } from "@/components/forms/form-input-group";
import { FormCheckboxGroup } from "@/components/forms/form-checkbox-group";
import { FlexibleDatePickerInput } from "@/components/forms/flexible-date-picker-input";
import { FormRadioGroup } from "@/components/forms/form-radio-group";
import { FormSelect } from "@/components/forms/form-select";
import { FormTextarea } from "@/components/forms/form-textarea";
import {
  IconPlus,
  IconLoader2,
  IconCalendar,
  IconMail,
  IconLock,
  IconUser,
  IconPhone,
  IconScale,
  IconRuler,
  IconDiscount,
} from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addDays, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  CARDIO_PREFERENCE_OPTIONS,
  DAYS_PER_WEEK_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  FOCUS_AREA_OPTIONS,
  PRIMARY_GOAL_OPTIONS,
  RESTRICTED_MOVEMENT_OPTIONS,
} from "@/lib/training/options";
import { CustomerData, calculateSubscriptionEndDate, useHookFormCustomerSheet } from "../hooks/use-hook-form-customers";
export type { CustomerData } from "../hooks/use-hook-form-customers";

interface CustomerFormSheetProps {
  mode?: "create" | "edit";
  customer?: CustomerData | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  entrypoint?: "customers" | "cash";
}

export function CustomerFormSheet({
  mode = "create",
  customer = null,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  entrypoint = "customers",
}: CustomerFormSheetProps) {
  const {
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
    reactivateCustomer,
  } = useHookFormCustomerSheet({
    mode,
    customer,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    entrypoint,
  });

  // Trigger por defecto para modo crear
  const defaultTrigger = (
    <Button className="text-xs md:text-sm" data-testid="customers-new-button">
      <IconPlus className="mr-2 h-4 w-4" /> Nuevo Cliente
    </Button>
  );
  const parqRequiresAttention = form.watch("parq_requires_attention");
  const showAttentionDetails = parqRequiresAttention === "yes";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>
      ) : ( 
        <SheetTrigger asChild>{defaultTrigger}</SheetTrigger>
      )}
      <SheetContent className="sm:max-w-xl w-full flex flex-col h-full p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b space-y-1 sticky top-0 bg-background/80 backdrop-blur-md z-10">
          <SheetTitle>
            {isEditing ? "Editar Cliente" : entrypoint === "cash" ? "Nuevo cliente + cobro" : "Registro de Nuevo Cliente"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modifica perfil, membresía, métricas y entrenamiento desde una sola ficha."
              : entrypoint === "cash"
                ? "Registra la ficha del cliente, asigna el plan y cobra dentro del turno actual."
                : "Completa la ficha de inscripción. El precio y fechas se calculan según el plan."}
          </SheetDescription>
        </SheetHeader>

        {isEditing && customer?.is_active === false && (
          <div className="bg-destructive/10 px-6 py-3 flex items-center justify-between border-b border-destructive/20">
            <span className="text-sm text-destructive font-medium">Este cliente está inactivo.</span>
            <Button
              size="sm"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-white h-7"
              onClick={reactivateCustomer}
            >
              Activar Cliente
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-4">
              {/* 1. LOGIN */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    1
                  </span>
                  Cuenta
                </h4>
                <div className="grid grid-cols-2 gap-4 pl-4">
                  <FormInputGroup
                    control={form.control}
                    name="email"
                    label="Correo electrónico"
                    placeholder="user@gym.com (opcional)"
                    type="email"
                    icon={<IconMail className="h-4 w-4" />}
                  />
                  <FormInputGroup
                    control={form.control}
                    name="password"
                    label={isEditing ? "Nueva Contraseña" : "Contraseña"}
                    placeholder={isEditing ? "(Dejar vacío para no cambiar)" : "(Opcional)"}
                    type="password"
                    icon={<IconLock className="h-4 w-4" />}
                  />
                </div>
              </div>

              <Separator />

              {/* 2. DATOS PERSONALES */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    2
                  </span>
                  Datos Personales
                </h4>
                <div className="grid grid-cols-2 gap-4 pl-4">
                  <FormInputGroup
                    control={form.control}
                    name="full_name"
                    label="Nombre Completo"
                    placeholder="Nombre Apellido"
                    icon={<IconUser className="h-4 w-4" />}
                  />
                  <Controller
                    control={form.control}
                    name="birth_date"
                    render={({ field, fieldState }) => (
                      <Field className="flex w-full flex-col" data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={String(field.name)}>Nacimiento</FieldLabel>
                        <FlexibleDatePickerInput value={field.value} onChange={field.onChange} endMonth={new Date()} />
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                  <FormSelect
                    control={form.control}
                    name="gender"
                    label="Género"
                    options={[
                      { label: "Masculino", value: "male" },
                      { label: "Femenino", value: "female" },
                      { label: "Otro", value: "other" },
                    ]}
                  />
                  <FormInputGroup
                    control={form.control}
                    name="phone"
                    label="Teléfono"
                    required
                    placeholder="12345678"
                    type="tel"
                    maxLength={8}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    icon={<IconPhone className="h-4 w-4" />}
                  />
                </div>
              </div>

              <Separator />

              {/* 3. MEMBRESÍA Y PAGOS */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    3
                  </span>
                  Membresía
                </h4>
                <div className="space-y-4 pl-4">
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

                  <Controller
                    control={form.control}
                    name="subscription_period"
                    render={({ field, fieldState }) => {
                      const from = field.value?.from;
                      const to = field.value?.to;
                      const daysDiff = from && to ? differenceInDays(to, from) : 0;
                      const membershipEndMonth = new Date(new Date().getFullYear() + 10, 11);

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

                      const applyPreset = (days: number) => {
                        const start = field.value?.from || new Date();
                        const end = addDays(start, days);
                        form.setValue("subscription_period", {
                          from: start,
                          to: end,
                        });
                      };

                      return (
                        <Field className="flex flex-col" data-invalid={fieldState.invalid}>
                          <FieldLabel>Vigencia de Suscripción</FieldLabel>
                          <div className="grid grid-cols-[1fr_1fr_auto_80px] gap-2 items-center">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Inicio</span>
                              <FlexibleDatePickerInput
                                value={from}
                                onChange={handleStartChange}
                                endMonth={membershipEndMonth}
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Fin</span>
                              <FlexibleDatePickerInput
                                value={to}
                                onChange={handleEndChange}
                                endMonth={membershipEndMonth}
                              />
                            </div>

                            <Popover modal={false}>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="outline" size="icon" className="mt-5">
                                  <IconCalendar className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="end">
                                <div className="flex">
                                  <div className="flex flex-col border-r p-2 min-w-[130px]">
                                    <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Períodos</p>
                                    <Button variant="ghost" size="sm" className="justify-start font-normal text-xs h-8" onClick={() => applyPreset(7)}>
                                      1 semana
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start font-normal text-xs h-8" onClick={() => applyPreset(15)}>
                                      15 días
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start font-normal text-xs h-8" onClick={() => applyPreset(30)}>
                                      1 mes
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start font-normal text-xs h-8" onClick={() => applyPreset(60)}>
                                      2 meses
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start font-normal text-xs h-8" onClick={() => applyPreset(90)}>
                                      3 meses
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start font-normal text-xs h-8" onClick={() => applyPreset(180)}>
                                      6 meses
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start font-normal text-xs h-8" onClick={() => applyPreset(365)}>
                                      1 año
                                    </Button>
                                  </div>

                                  <Calendar
                                    autoFocus
                                    mode="range"
                                    defaultMonth={from}
                                    selected={
                                      subscriptionPeriod?.from
                                        ? { from: subscriptionPeriod.from, to: subscriptionPeriod.to }
                                        : undefined
                                    }
                                    onSelect={handleDateRangeChange}
                                    numberOfMonths={2}
                                    locale={es}
                                  />
                                </div>
                              </PopoverContent>
                            </Popover>

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
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm font-bold">Q</span>
                        <input
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 pl-7 py-2 text-sm font-bold text-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled
                          value={form.watch("final_price")?.toFixed(2) || "0.00"}
                        />
                      </div>
                    </div>
                  </div>

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

              {/* 4. PERFIL DE ENTRENAMIENTO */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    4
                  </span>
                  Perfil de Entrenamiento
                </h4>
                <div className="space-y-4 pl-4">
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                    <div className="space-y-1">
                      <h5 className="text-sm font-semibold">Objetivo</h5>
                      <p className="text-xs text-muted-foreground">
                        Si dejas campos vacíos, el cliente se guarda y la rutina quedará pendiente hasta completar el
                        perfil.
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
                        Captura si necesita atención especial antes de entrenar y qué movimientos conviene limitar.
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
                      <h5 className="text-sm font-semibold">Perfil de entrenamiento</h5>
                      <p className="text-xs text-muted-foreground">
                        Esto define frecuencia, duración y el tipo de ejercicios que sí puede hacer.
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
                      <FormSelect
                        control={form.control}
                        name="activity_level"
                        label="Nivel de actividad diaria"
                        placeholder="Seleccionar..."
                        options={[
                          { label: "Poco o nada", value: "sedentario" },
                          { label: "1 a 3 días/semana", value: "1_3_dias" },
                          { label: "3 a 5 días/semana", value: "3_5_dias" },
                          { label: "6 a 7 días/semana", value: "6_7_dias" },
                          { label: "2 veces al día", value: "2_veces_dia" },
                        ]}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <h6 className="text-sm font-medium">Duración por sesión</h6>
                        <p className="text-xs text-muted-foreground">
                          Define la sesión con más libertad usando horas y minutos.
                        </p>
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

                  <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                    <div className="space-y-1">
                      <h5 className="text-sm font-semibold">Métricas base y seguimiento</h5>
                      <p className="text-xs text-muted-foreground">
                        Peso y estatura ayudan a calcular nutrición. El resto sirve para seguimiento, no para bloquear
                        la creación del cliente.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInputGroup
                        control={form.control}
                        name="weight_lb"
                        label="Peso (lb)"
                        type="number"
                        icon={<IconScale className="h-4 w-4" />}
                        placeholder="154"
                      />
                      <FormInputGroup
                        control={form.control}
                        name="height_cm"
                        label="Estatura (cm)"
                        type="number"
                        icon={<IconRuler className="h-4 w-4" />}
                        placeholder="170"
                      />
                      <FormSelect
                        control={form.control}
                        name="body_type"
                        label="Somatotipo"
                        placeholder="Opcional"
                        options={[
                          { label: "Ectomorfo", value: "ectomorph" },
                          { label: "Mesomorfo", value: "mesomorph" },
                          { label: "Endomorfo", value: "endomorph" },
                        ]}
                      />
                      <FormSelect
                        control={form.control}
                        name="diet_type"
                        label="Enfoque nutricional"
                        placeholder="Seleccionar..."
                        options={[
                          { label: "Hipocalórica", value: "hipocalorica" },
                          { label: "Normocalórica", value: "normocalorica" },
                          { label: "Hipercalórica", value: "hipercalorica" },
                        ]}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInputGroup control={form.control} name="body_fat_percentage" label="% Grasa" type="number" />
                      <FormInputGroup control={form.control} name="muscle_mass_kg" label="Masa Muscular (kg)" type="number" />
                      <FormInputGroup control={form.control} name="chest" label="Pecho (cm)" type="number" />
                      <FormInputGroup control={form.control} name="waist" label="Cintura (cm)" type="number" />
                      <FormInputGroup control={form.control} name="hip" label="Cadera (cm)" type="number" />
                      <FormInputGroup control={form.control} name="arm_right" label="Brazo Der. (cm)" type="number" />
                      <FormInputGroup control={form.control} name="arm_left" label="Brazo Izq. (cm)" type="number" />
                      <FormInputGroup control={form.control} name="leg_right" label="Pierna Der. (cm)" type="number" />
                      <FormInputGroup control={form.control} name="leg_left" label="Pierna Izq. (cm)" type="number" />
                    </div>
                    <FormTextarea
                      control={form.control}
                      name="injuries"
                      label="Observaciones generales"
                      placeholder="Notas generales que quieras dejar guardadas en el perfil."
                      config={{ rows: 3, maxLength: 240 }}
                    />
                  </div>
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
            </form>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-background/80 backdrop-blur-md z-10 font-sans">
          <SheetClose asChild>
            <Button variant="outline" disabled={isPending} data-testid="customers-cancel-button">
              Cancelar
            </Button>
          </SheetClose>
          <Button
            type="submit"
            disabled={isPending}
            onClick={form.handleSubmit(onSubmit)}
            data-testid="customers-submit-button"
          >
            {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar Cambios" : "Registrar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
