"use client";

import { useState } from "react";
import { IconClipboardHeart, IconEdit, IconPlus, IconRuler, IconScale } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateCustomerBodyAssessment,
  useUpdateCustomerBodyAssessment,
} from "@/features/customers/hooks/use-customers";
import {
  bodyAssessmentCreateSchema,
  bodyAssessmentUpdateSchema,
  type BodyAssessmentsResponse,
  type BodyAssessmentWriteInput,
  type CustomerBodyAssessment,
} from "@/features/customers/lib/customer-health";
import { WeightChart } from "./weight-chart";

const measurementFields = [
  ["weight_kg", "Peso", "kg", 700],
  ["height_cm", "Altura", "cm", 300],
  ["body_fat_percentage", "Grasa corporal", "%", 100],
  ["muscle_mass_kg", "Masa muscular", "kg", 500],
  ["chest", "Pecho", "cm", 500],
  ["waist", "Cintura", "cm", 500],
  ["hip", "Cadera", "cm", 500],
  ["arm_right", "Brazo derecho", "cm", 500],
  ["arm_left", "Brazo izquierdo", "cm", 500],
  ["leg_right", "Pierna derecha", "cm", 500],
  ["leg_left", "Pierna izquierda", "cm", 500],
] as const;

const nutritionFields = [
  ["body_type", "Tipo corporal", "text", undefined],
  ["activity_level", "Nivel de actividad", "text", undefined],
  ["diet_type", "Tipo de dieta", "text", undefined],
  ["water_liters_goal", "Agua objetivo", "number", "L"],
  ["daily_calories", "Calorías diarias", "number", "kcal"],
  ["protein_grams", "Proteína", "number", "g"],
  ["carbs_grams", "Carbohidratos", "number", "g"],
  ["fat_grams", "Grasa", "number", "g"],
] as const;

type AssessmentForm = Record<string, string>;

function formFromAssessment(assessment: CustomerBodyAssessment | null): AssessmentForm {
  const form: AssessmentForm = { assessment_date: assessment?.assessment_date ?? "", notes: assessment?.notes ?? "" };
  for (const [key] of measurementFields) form[key] = assessment?.[key]?.toString() ?? "";
  for (const [key] of nutritionFields) form[key] = assessment?.nutrition_snapshot?.[key]?.toString() ?? "";
  return form;
}

function calendarDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function metric(value: number | null, unit: string): string {
  return value === null ? "—" : `${value} ${unit}`;
}

function formHasAssessmentContent(form: AssessmentForm): boolean {
  if (measurementFields.some(([key]) => form[key].trim() !== "")) return true;
  if (form.notes.trim() !== "") return true;
  return nutritionFields.some(([key]) => form[key].trim() !== "");
}

export function BodyAssessmentTab({
  customerId,
  response,
  canManage,
}: {
  customerId: string;
  response: BodyAssessmentsResponse;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerBodyAssessment | null>(null);
  const [form, setForm] = useState<AssessmentForm>(() => formFromAssessment(null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createMutation = useCreateCustomerBodyAssessment();
  const updateMutation = useUpdateCustomerBodyAssessment();
  const pending = createMutation.isPending || updateMutation.isPending;

  const changeOpen = (next: boolean, assessment: CustomerBodyAssessment | null = null) => {
    if (!next && pending) return;
    setOpen(next);
    setEditing(next ? assessment : null);
    setForm(formFromAssessment(next ? assessment : null));
    setErrors({});
  };

  const buildPayload = (): BodyAssessmentWriteInput => {
    const payload: BodyAssessmentWriteInput = {};
    if (form.assessment_date && form.assessment_date !== editing?.assessment_date) payload.assessment_date = form.assessment_date;
    for (const [key] of measurementFields) {
      const original = editing?.[key] ?? null;
      const next = form[key] === "" ? null : Number(form[key]);
      if (editing ? next !== original : next !== null) payload[key] = next;
    }
    const notes = form.notes.trim() || null;
    if (editing ? notes !== editing.notes : notes !== null) payload.notes = notes;

    const nutrition: NonNullable<BodyAssessmentWriteInput["nutrition_snapshot"]> = {};
    for (const [key, , type] of nutritionFields) {
      const original = editing?.nutrition_snapshot?.[key] ?? null;
      const next = form[key].trim() === "" ? null : type === "number" ? Number(form[key]) : form[key].trim();
      if (editing ? next !== original : next !== null) nutrition[key] = next as never;
    }
    if (Object.keys(nutrition).length) payload.nutrition_snapshot = nutrition;
    return payload;
  };

  const hasContent = formHasAssessmentContent(form);
  const isDirty = Object.keys(buildPayload()).length > 0;

  const submit = async () => {
    if (!hasContent) {
      setErrors({ body: "Ingresa al menos una medición, nota o dato nutricional." });
      return;
    }
    const schema = editing ? bodyAssessmentUpdateSchema : bodyAssessmentCreateSchema;
    const parsed = schema.safeParse(buildPayload());
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) nextErrors[String(issue.path.at(-1) ?? "body")] = issue.message;
      setErrors(nextErrors);
      return;
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: customerId, assessmentId: editing.id, data: parsed.data });
      } else {
        await createMutation.mutateAsync({ id: customerId, data: parsed.data });
      }
      changeOpen(false);
    } catch {
      // The mutation renders a sanitized error toast and the dialog stays open.
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold">Evaluaciones corporales</h3>
          <p className="text-sm text-muted-foreground">Mediciones reales registradas, de la más reciente a la más antigua.</p>
        </div>
        {canManage ? <Button onClick={() => changeOpen(true)}><IconPlus className="h-4 w-4" /> Nueva evaluación</Button> : null}
      </div>

      <WeightChart data={response.data} />

      {response.data.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 text-center"><IconClipboardHeart className="h-10 w-10 text-muted-foreground/40" /><p className="font-medium">Aún no hay evaluaciones corporales</p><p className="text-sm text-muted-foreground">{canManage ? "Puedes registrar una evaluación parcial con al menos una medición, nota o dato nutricional." : "No hay mediciones registradas para mostrar."}</p></CardContent></Card>
      ) : (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {response.data.map((assessment) => (
            <Card key={assessment.id} className="min-w-0 overflow-hidden border-primary/10">
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b bg-muted/20">
                <div><CardTitle className="text-base">{calendarDate(assessment.assessment_date)}</CardTitle><p className="text-xs text-muted-foreground">Evaluación corporal</p></div>
                {canManage ? <Button size="sm" variant="outline" onClick={() => changeOpen(true, assessment)}><IconEdit className="h-4 w-4" /> Editar</Button> : null}
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label="Peso" value={metric(assessment.weight_kg, "kg")} icon={<IconScale />} />
                  <Metric label="Altura" value={metric(assessment.height_cm, "cm")} icon={<IconRuler />} />
                  <Metric label="Grasa" value={metric(assessment.body_fat_percentage, "%")} />
                  <Metric label="Músculo" value={metric(assessment.muscle_mass_kg, "kg")} />
                </div>
                <div className="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
                  {measurementFields.slice(4).map(([key, label, unit]) => <Row key={key} label={label} value={metric(assessment[key], unit)} />)}
                </div>
                {assessment.notes ? <div className="rounded-lg border bg-muted/10 p-3"><p className="text-xs text-muted-foreground">Notas</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{assessment.notes}</p></div> : null}
                {assessment.nutrition_snapshot ? <div className="rounded-lg border bg-muted/10 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instantánea nutricional</p><div className="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">{nutritionFields.map(([key, label, type, unit]) => <Row key={key} label={label} value={assessment.nutrition_snapshot?.[key] === null ? "—" : `${assessment.nutrition_snapshot?.[key]}${type === "number" && unit ? ` ${unit}` : ""}`} />)}</div></div> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {canManage ? (
        <Dialog open={open} onOpenChange={(next) => changeOpen(next, editing)}>
          <DialogContent className="max-h-[90vh] min-w-0 overflow-y-auto sm:max-w-4xl">
            <DialogHeader><DialogTitle>{editing ? "Editar evaluación corporal" : "Nueva evaluación corporal"}</DialogTitle><DialogDescription>Registra únicamente datos medidos. Puedes guardar una evaluación parcial.</DialogDescription></DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2"><Label htmlFor="assessment-date">Fecha (opcional)</Label><Input id="assessment-date" type="date" value={form.assessment_date} onChange={(event) => setForm((current) => ({ ...current, assessment_date: event.target.value }))} autoFocus aria-invalid={Boolean(errors.assessment_date)} />{errors.assessment_date ? <p className="text-xs text-destructive">{errors.assessment_date}</p> : null}</div>
              <fieldset className="space-y-3"><legend className="font-semibold">Mediciones</legend><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{measurementFields.map(([key, label, unit, max]) => <NumberField key={key} id={key} label={`${label} (${unit})`} value={form[key]} max={max} error={errors[key]} onChange={(value) => setForm((current) => ({ ...current, [key]: value }))} />)}</div></fieldset>
              <div className="space-y-2"><Label htmlFor="assessment-notes">Notas</Label><Textarea id="assessment-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} aria-invalid={Boolean(errors.notes)} />{errors.notes ? <p className="text-xs text-destructive">{errors.notes}</p> : null}</div>
              <fieldset className="space-y-3"><legend className="font-semibold">Instantánea nutricional (opcional)</legend><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{nutritionFields.map(([key, label, type, unit]) => type === "number" ? <NumberField key={key} id={key} label={`${label}${unit ? ` (${unit})` : ""}`} value={form[key]} error={errors[key]} onChange={(value) => setForm((current) => ({ ...current, [key]: value }))} /> : <div key={key} className="space-y-2"><Label htmlFor={`assessment-${key}`}>{label}</Label><Input id={`assessment-${key}`} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} aria-invalid={Boolean(errors[key])} />{errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null}</div>)}</div></fieldset>
              {errors.body ? <p className="text-sm text-destructive">{errors.body}</p> : null}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => changeOpen(false)} disabled={pending}>Cancelar</Button><Button onClick={submit} disabled={pending || !isDirty || !hasContent}>{pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear evaluación"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function NumberField({ id, label, value, error, onChange, max }: { id: string; label: string; value: string; error?: string; onChange: (value: string) => void; max?: number }) {
  return <div className="space-y-2"><Label htmlFor={`assessment-${id}`}>{label}</Label><Input id={`assessment-${id}`} type="number" min="0" max={max} step="any" value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} />{error ? <p className="text-xs text-destructive">{error}</p> : null}</div>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div className="min-w-0 rounded-lg border bg-muted/10 p-3"><div className="flex items-center gap-1 text-xs text-muted-foreground">{icon}<span>{label}</span></div><p className="mt-1 truncate font-bold">{value}</p></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-0 justify-between gap-3 border-b py-1 last:border-0"><span className="text-muted-foreground">{label}</span><span className="break-words text-right font-medium">{value}</span></div>;
}
