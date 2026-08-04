"use client";

import { useMemo, useState } from "react";
import { IconAlertTriangle, IconEdit, IconHeartbeat } from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateCustomerHealthProfile } from "@/features/customers/hooks/use-customers";
import {
  customerHealthProfileUpdateSchema,
  type CustomerHealthProfile,
  type CustomerHealthProfileUpdateInput,
} from "@/features/customers/lib/customer-health";

type HealthFormState = Record<string, string> & { parq: "unset" | "yes" | "no" };

const textFields = [
  ["parq_details", "Detalles PAR-Q", "textarea"],
  ["injuries_or_pain", "Lesiones o dolor", "textarea"],
  ["medical_conditions", "Condiciones médicas", "textarea"],
  ["medications", "Medicamentos", "textarea"],
  ["medical_clearance_notes", "Notas de autorización médica", "textarea"],
  ["restricted_movements", "Movimientos restringidos", "textarea"],
  ["primary_goal", "Objetivo principal", "input"],
  ["secondary_goal", "Objetivo secundario", "input"],
  ["experience_level", "Nivel de experiencia", "input"],
  ["training_location", "Lugar de entrenamiento", "input"],
  ["cardio_preference", "Preferencia de cardio", "input"],
  ["exercise_preferences", "Ejercicios preferidos", "textarea"],
  ["exercise_dislikes", "Ejercicios que evita", "textarea"],
  ["diet_type", "Tipo de dieta", "input"],
  ["activity_level", "Nivel de actividad", "input"],
] as const;

const readGroups = [
  ["Seguridad médica", ["parq_details", "injuries_or_pain", "medical_conditions", "medications", "medical_clearance_notes", "restricted_movements"]],
  ["Perfil de entrenamiento", ["primary_goal", "secondary_goal", "focus_areas", "experience_level", "days_per_week", "session_minutes", "training_location", "equipment_available", "cardio_preference", "exercise_preferences", "exercise_dislikes"]],
  ["Nutrición y actividad", ["diet_type", "activity_level"]],
] as const;

const labels: Record<string, string> = {
  parq_details: "Detalles PAR-Q", injuries_or_pain: "Lesiones o dolor", medical_conditions: "Condiciones médicas",
  medications: "Medicamentos", medical_clearance_notes: "Autorización médica", restricted_movements: "Movimientos restringidos",
  primary_goal: "Objetivo principal", secondary_goal: "Objetivo secundario", focus_areas: "Áreas de enfoque",
  experience_level: "Experiencia", days_per_week: "Días por semana", session_minutes: "Minutos por sesión",
  training_location: "Lugar", equipment_available: "Equipo disponible", cardio_preference: "Cardio",
  exercise_preferences: "Preferencias", exercise_dislikes: "Restricciones o desagrados", diet_type: "Dieta",
  activity_level: "Nivel de actividad",
};

function stateFromProfile(profile: CustomerHealthProfile): HealthFormState {
  const state: HealthFormState = {
    parq: profile.parq_requires_attention === null ? "unset" : profile.parq_requires_attention ? "yes" : "no",
  };
  for (const [key] of textFields) state[key] = profile[key] ?? "";
  state.focus_areas = profile.focus_areas?.join(", ") ?? "";
  state.equipment_available = profile.equipment_available?.join(", ") ?? "";
  state.days_per_week = profile.days_per_week?.toString() ?? "";
  state.session_minutes = profile.session_minutes?.toString() ?? "";
  return state;
}

function emptyHealthFormState(): HealthFormState {
  const state: HealthFormState = { parq: "unset" };
  for (const [key] of textFields) state[key] = "";
  state.focus_areas = "";
  state.equipment_available = "";
  state.days_per_week = "";
  state.session_minutes = "";
  return state;
}

function normalizeArray(value: string): string[] | null {
  const values = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  return values.length ? values : null;
}

function displayValue(value: string | number | string[] | null): string {
  if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) return "Sin información";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function buildHealthProfilePatch(
  form: HealthFormState,
  profile: CustomerHealthProfile,
): CustomerHealthProfileUpdateInput {
  const candidate: CustomerHealthProfileUpdateInput = {};
  const nextParq = form.parq === "unset" ? null : form.parq === "yes";
  if (nextParq !== profile.parq_requires_attention) candidate.parq_requires_attention = nextParq;

  for (const [key] of textFields) {
    const nextValue = form[key].trim() || null;
    if (nextValue !== profile[key]) candidate[key] = nextValue;
  }
  for (const key of ["focus_areas", "equipment_available"] as const) {
    const nextValue = normalizeArray(form[key]);
    if (JSON.stringify(nextValue) !== JSON.stringify(profile[key])) candidate[key] = nextValue;
  }
  for (const key of ["days_per_week", "session_minutes"] as const) {
    const nextValue = form[key].trim() ? Number(form[key]) : null;
    if (nextValue !== profile[key]) candidate[key] = nextValue;
  }

  return candidate;
}

function hasHealthProfileInformation(profile: CustomerHealthProfile): boolean {
  if (profile.parq_requires_attention !== null) return true;
  if (textFields.some(([key]) => profile[key] !== null && profile[key] !== "")) return true;
  if (profile.days_per_week !== null || profile.session_minutes !== null) return true;
  return [profile.focus_areas, profile.equipment_available]
    .some((values) => values !== null && values.length > 0);
}

export function CustomerHealthProfileSection({
  profile,
  canManage,
}: {
  profile: CustomerHealthProfile;
  canManage: boolean;
}) {
  const mutation = useUpdateCustomerHealthProfile();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<HealthFormState>(() => stateFromProfile(profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const baseline = useMemo(() => stateFromProfile(profile), [profile]);
  const patch = useMemo(() => buildHealthProfilePatch(form, profile), [form, profile]);
  const isDirty = Object.keys(patch).length > 0;
  const hasInformation = hasHealthProfileInformation(profile);

  const setDialogOpen = (next: boolean) => {
    setOpen(next);
    setErrors({});
    setForm(next ? baseline : emptyHealthFormState());
  };

  const updateParq = (value: string) => {
    if (form.parq === "yes" && value !== "yes" && form.parq_details.trim()) {
      const confirmed = window.confirm("Los detalles PAR-Q se conservarán. ¿Deseas cambiar la respuesta?");
      if (!confirmed) return;
    }
    setForm((current) => ({ ...current, parq: value as HealthFormState["parq"] }));
  };

  const submit = async () => {
    const parsed = customerHealthProfileUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) nextErrors[String(issue.path[0] ?? "body")] = issue.message;
      setErrors(nextErrors);
      return;
    }
    try {
      await mutation.mutateAsync({ id: profile.customer_id, data: parsed.data });
      setDialogOpen(false);
    } catch {
      // The mutation renders a sanitized error toast and the dialog stays open.
    }
  };

  return (
    <>
      <Card className="min-w-0 border-primary/10">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><IconHeartbeat className="h-5 w-5 text-primary" /> Perfil de salud</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Información privada visible únicamente para personal autorizado.</p>
          </div>
          {canManage ? <Button size="sm" onClick={() => setDialogOpen(true)}><IconEdit className="h-4 w-4" /> Editar salud</Button> : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasInformation ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Perfil de salud pendiente. Aún no se ha registrado información.
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
            <span className="font-medium">PAR-Q</span>
            <Badge variant={profile.parq_requires_attention ? "warning" : "secondary"}>
              {profile.parq_requires_attention === null ? "Sin información" : profile.parq_requires_attention ? "Sí, requiere atención" : "No requiere atención"}
            </Badge>
          </div>
          {profile.parq_requires_attention ? (
            <Alert variant="destructive">
              <IconAlertTriangle className="h-4 w-4" />
              <AlertTitle>Requiere atención antes de entrenar</AlertTitle>
              <AlertDescription>{profile.parq_details || "No se registraron detalles adicionales."}</AlertDescription>
            </Alert>
          ) : null}
          {readGroups.map(([title, keys]) => (
            <section key={title} className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {keys.map((key) => (
                  <div key={key} className="min-w-0 rounded-lg border bg-muted/10 p-3">
                    <p className="text-xs text-muted-foreground">{labels[key]}</p>
                    <p className="mt-1 break-words text-sm font-medium">{displayValue(profile[key])}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      {canManage ? (
        <Dialog open={open} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] min-w-0 overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Editar perfil de salud</DialogTitle>
              <DialogDescription>Solo se enviarán los campos que hayan cambiado. Los campos vacíos se limpiarán.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold">¿El PAR-Q requiere atención?</legend>
                <RadioGroup value={form.parq} onValueChange={updateParq} className="flex flex-wrap gap-4">
                  {[["unset", "Sin definir"], ["yes", "Sí"], ["no", "No"]].map(([value, label], index) => (
                    <Label key={value} className="flex items-center gap-2"><RadioGroupItem value={value} autoFocus={index === 0} /> {label}</Label>
                  ))}
                </RadioGroup>
              </fieldset>
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                {textFields.map(([key, label, control]) => (
                  <div key={key} className={control === "textarea" ? "space-y-2 md:col-span-2" : "space-y-2"}>
                    <Label htmlFor={`health-${key}`}>{label}</Label>
                    {control === "textarea" ? (
                      <Textarea id={`health-${key}`} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} aria-invalid={Boolean(errors[key])} />
                    ) : (
                      <Input id={`health-${key}`} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} aria-invalid={Boolean(errors[key])} />
                    )}
                    {errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null}
                  </div>
                ))}
                <HealthInput id="focus_areas" label="Áreas de enfoque (separadas por coma)" value={form.focus_areas} error={errors.focus_areas} onChange={(value) => setForm((current) => ({ ...current, focus_areas: value }))} />
                <HealthInput id="equipment_available" label="Equipo disponible (separado por coma)" value={form.equipment_available} error={errors.equipment_available} onChange={(value) => setForm((current) => ({ ...current, equipment_available: value }))} />
                <HealthInput id="days_per_week" label="Días por semana (1–7)" type="number" min="1" max="7" value={form.days_per_week} error={errors.days_per_week} onChange={(value) => setForm((current) => ({ ...current, days_per_week: value }))} />
                <HealthInput id="session_minutes" label="Minutos por sesión (15–480)" type="number" min="15" max="480" value={form.session_minutes} error={errors.session_minutes} onChange={(value) => setForm((current) => ({ ...current, session_minutes: value }))} />
              </div>
              {errors.body ? <p className="text-sm text-destructive">{errors.body}</p> : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={mutation.isPending}>Cancelar</Button>
              <Button onClick={submit} disabled={mutation.isPending || !isDirty}>{mutation.isPending ? "Guardando…" : "Guardar cambios"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function HealthInput({ id, label, error, onChange, ...props }: {
  id: string; label: string; value: string; error?: string; onChange: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, "id" | "onChange">) {
  return <div className="space-y-2"><Label htmlFor={`health-${id}`}>{label}</Label><Input id={`health-${id}`} {...props} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} />{error ? <p className="text-xs text-destructive">{error}</p> : null}</div>;
}
