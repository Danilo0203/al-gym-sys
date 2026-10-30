"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { collectEnrollment, getEnrollment, reviewEnrollment } from "./enrollment-actions";
import { enrollmentLabel, type EnrollmentQuote, type EnrollmentState } from "./enrollment-types";

const money = (n: number) => `Q${n.toFixed(2)}`;
type Props = {
  customerId?: string;
  selectForMembership?: boolean;
  disabled?: boolean;
  onChange?: (quote: EnrollmentQuote | undefined, ready: boolean) => void;
};

export function EnrollmentPanel({ customerId, selectForMembership = false, disabled = false, onChange }: Props) {
  const router = useRouter();
  const [state, setState] = useState<EnrollmentState>();
  const [selected, setSelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<"cash" | "card" | "transfer">("cash");
  const apply = useCallback((next: EnrollmentState) => {
    const checked = selectForMembership && next.status === "pending";
    setState(next);
    setSelected(checked);
    onChange?.(checked ? { year: next.year, fee: next.fee } : undefined, true);
  }, [onChange, selectForMembership]);
  const load = useCallback(async () => {
    setError("");
    onChange?.(undefined, false);
    try { apply(await getEnrollment(customerId)); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo consultar la inscripción"); }
  }, [apply, customerId, onChange]);
  useEffect(() => {
    let active = true;
    onChange?.(undefined, false);
    getEnrollment(customerId).then((next) => { if (active) apply(next); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "No se pudo consultar la inscripción"); });
    return () => { active = false; };
  }, [apply, customerId, onChange]);

  async function run(operation: () => Promise<EnrollmentState>, message: string) {
    setBusy(true);
    onChange?.(undefined, false);
    try {
      apply(await operation()); setReason(""); toast.success(message); router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la inscripción");
      await load();
    } finally { setBusy(false); }
  }

  if (error) return <div className="rounded-lg border p-3 text-sm" role="alert">
    <p>{error}</p><Button type="button" variant="outline" size="sm" onClick={load}>Reintentar inscripción</Button>
  </div>;
  if (!state) return <p className="p-3 text-sm text-muted-foreground">Consultando inscripción…</p>;
  const enrolled = state.status === "paid" || state.status === "recognized";
  const blocked = busy || disabled;
  return <section className="space-y-3 rounded-lg border bg-muted/20 p-3" aria-label="Inscripción anual">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Badge variant={enrolled ? "success" : "outline"}>{enrollmentLabel(state)}</Badge>
      <Button type="button" size="sm" variant="ghost" disabled={blocked} onClick={load}>Actualizar</Button>
    </div>
    {enrolled ? <p className="text-xs text-muted-foreground">
      Válida hasta el 31/12/{state.year}, aunque se ausente.
      {state.status === "recognized" ? " Pago anterior reconocido; sin nuevo ingreso a Caja." : ` Pagada: ${money(state.amount ?? 0)}.`}
    </p> : <>
      {state.status === "needs_review" && <p className="text-sm">Verifica si ya pagó este año antes de añadir otro cobro.</p>}
      {customerId && (state.can_manage || (state.can_collect && state.status === "needs_review")) && <div className="space-y-2">
        {state.can_manage && <Input aria-label="Motivo de revisión de inscripción" placeholder="Motivo o referencia del pago anterior" value={reason} disabled={blocked} onChange={(e) => setReason(e.target.value)} />}
        <div className="flex flex-wrap gap-2">
          {state.status === "needs_review" && state.can_collect && <Button type="button" size="sm" variant="outline" disabled={blocked}
            onClick={() => run(() => reviewEnrollment(customerId, state.year, "pending", reason.trim() || "Se verificó que la inscripción está pendiente"), "Inscripción pendiente de cobro")}>Pendiente de pago</Button>}
          {state.can_manage && <Button type="button" size="sm" variant="outline" disabled={blocked || !reason.trim()}
            onClick={() => run(() => reviewEnrollment(customerId, state.year, "recognized", reason.trim()), "Pago anterior reconocido; no se registró un ingreso nuevo")}>Ya pagó anteriormente</Button>}
        </div>
      </div>}
      {state.status === "pending" && selectForMembership && <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <Checkbox checked={selected} disabled={blocked} onCheckedChange={(value) => {
          const checked = value === true; setSelected(checked);
          onChange?.(checked ? { year: state.year, fee: state.fee } : undefined, true);
        }} />Cobrar inscripción — {money(state.fee)}
      </label>}
      {state.status === "pending" && selectForMembership && !selected && <p className="text-xs text-muted-foreground">Quedará pendiente; puedes cobrarla después.</p>}
      {state.status === "pending" && !selectForMembership && customerId && state.can_collect && <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Método de pago de inscripción" className="h-9 rounded-md border bg-background px-2 text-sm" disabled={blocked} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
          <option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="transfer">Transferencia</option>
        </select>
        <Button type="button" size="sm" disabled={blocked} onClick={() => run(
          () => collectEnrollment(customerId, { year: state.year, fee: state.fee }, method), "Inscripción cobrada. La mensualidad conserva su vigencia.",
        )}>Cobrar solo inscripción — {money(state.fee)}</Button>
      </div>}
    </>}
  </section>;
}
