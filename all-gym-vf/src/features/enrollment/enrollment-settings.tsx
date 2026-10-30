"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getEnrollment, updateEnrollmentFee } from "./enrollment-actions";

export function EnrollmentSettings() {
  const [fee, setFee] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    getEnrollment().then((state) => { setFee(state.fee.toFixed(2)); setReady(state.can_manage); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo cargar la tarifa"));
  }, []);
  async function save() {
    setBusy(true);
    try { const state = await updateEnrollmentFee(Number(fee)); setFee(state.fee.toFixed(2)); toast.success("Tarifa guardada para cobros futuros"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo guardar la tarifa"); }
    finally { setBusy(false); }
  }
  return <section className="mb-4 shrink-0 rounded-lg border p-4" aria-label="Tarifa de inscripción anual">
    <h2 className="font-semibold">Inscripción anual</h2>
    <p className="mb-3 text-sm text-muted-foreground">La tarifa se aplica a cobros futuros. Las inscripciones pagadas conservan su importe.</p>
    {error ? <p role="alert">{error}</p> : <div className="flex items-center gap-2">
      <label htmlFor="enrollment-fee">Q</label><Input id="enrollment-fee" aria-label="Tarifa de inscripción" className="max-w-36" type="number" min="0.01" step="0.01" value={fee} disabled={!ready || busy} onChange={(e) => setFee(e.target.value)} />
      <Button type="button" disabled={!ready || busy || !Number.isFinite(Number(fee)) || Number(fee) <= 0} onClick={save}>Guardar tarifa</Button>
    </div>}
  </section>;
}
