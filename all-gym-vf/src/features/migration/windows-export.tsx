"use client";
import { useEffect, useState } from "react";
import { Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

type Job = { id: string; state: "running" | "ready" | "failed"; message: string; expiresAt: number;
  preview?: { snapshotAt: string; customers: number; plans: number; memberships: number; payments: number; attendance: number; routines: number } };
const base = "/api/windows-export";
async function read(response: Response) { const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "No se pudo consultar la exportación."); return data; }
export function WindowsExport() {
  const [job, setJob] = useState<Job | null>(null), [loading, setLoading] = useState(true), [sending, setSending] = useState(false);
  const [confirmed, setConfirmed] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetch(`${base}/jobs`, { cache: "no-store" }).then(read).then(data => { if (live) setJob(data.job); }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  const jobId = job?.id, jobState = job?.state;
  useEffect(() => {
    if (jobState !== "running" || !jobId) return;
    let live = true; let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { const next = await read(await fetch(`${base}/jobs/${jobId}`, { cache: "no-store" })); if (live) { setJob(next); setError(""); } }
      catch { if (live) setError("Esperando conexión con Hostinger. La preparación continúa; no necesitas iniciarla otra vez."); }
      if (live) timer = setTimeout(poll, 3000);
    }
    timer = setTimeout(poll, 2000); return () => { live = false; clearTimeout(timer); };
  }, [jobId, jobState]);
  async function start() {
    setSending(true); setError("");
    const id = crypto.randomUUID();
    try {
      const next = await read(await fetch(`${base}/jobs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, confirmed }) }));
      setJob(next); setConfirmed(false);
    } catch (e) {
      // Resolve an accepted request whose response was lost before allowing another export.
      try { const latest = await read(await fetch(`${base}/jobs`, { cache: "no-store" })); setJob(latest.job); } catch { /* Error below remains actionable. */ }
      setError(e instanceof Error ? e.message : "No se pudo iniciar la exportación.");
    } finally { setSending(false); }
  }
  const busy = loading || sending || job?.state === "running";
  const counts = job?.preview ? [["Clientes", job.preview.customers], ["Planes", job.preview.plans], ["Membresías", job.preview.memberships], ["Pagos", job.preview.payments], ["Asistencias", job.preview.attendance], ["Rutinas", job.preview.routines]] as const : [];
  return <div className="mx-auto w-full max-w-3xl space-y-6 pb-8">
    <Card><CardHeader><CardTitle>Preparar una copia actualizada</CardTitle><CardDescription>El archivo .algym incluye clientes, planes, pagos, asistencias y cuentas para instalarlos en un equipo Windows nuevo.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">La exportación consulta Hostinger sin cambiar sus registros. La cola del reloj quedará vacía en Windows; las órdenes anteriores se conservan en el respaldo completo que también puedes descargar.</p>
        <label className="flex items-start gap-3 rounded-lg border p-4 text-sm"><Checkbox checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} disabled={busy} /><span>Quiero generar una copia nueva. Entiendo que los registros añadidos después de la captura necesitarán otra exportación.</span></label>
        <Button disabled={busy || !confirmed} onClick={() => void start()}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}Exportar para Windows</Button>
        {error && <p role="alert" className="flex gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="size-5 shrink-0" />{error}</p>}
      </CardContent>
    </Card>
    {job && <Card><CardHeader><CardTitle className="flex items-center gap-2">{job.state === "ready" ? <CheckCircle2 className="size-5 text-green-600" /> : job.state === "running" ? <Loader2 className="size-5 animate-spin" /> : <AlertCircle className="size-5" />}{job.state === "ready" ? "Copia lista" : job.state === "running" ? "Preparando respaldo" : "Exportación pendiente"}</CardTitle><CardDescription role="status" aria-live="polite">{job.message}</CardDescription></CardHeader>
      {job.state === "ready" && job.preview && <CardContent className="space-y-5">
        <p className="text-sm">Datos capturados el {new Date(job.preview.snapshotAt).toLocaleString("es-GT", { dateStyle: "long", timeStyle: "short" })}.</p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">{counts.map(([label, value]) => <div key={label} className="rounded-lg border p-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold">{value.toLocaleString("es-GT")}</dd></div>)}</dl>
        <div className="flex flex-wrap gap-3"><Button asChild><a href={`${base}/jobs/${job.id}/file`}><Download className="mr-2 size-4" />Descargar .algym</a></Button><Button variant="outline" asChild><a href={`${base}/jobs/${job.id}/archive`}>Guardar respaldo completo</a></Button></div>
        <p className="text-sm text-muted-foreground">Disponibles hasta {new Date(job.expiresAt).toLocaleString("es-GT")}. Guarda ambos archivos en un lugar privado. Solo el .algym se importa en Windows.</p>
      </CardContent>}
    </Card>}
    <p className="text-sm text-muted-foreground">Antes del traslado definitivo, acuerda cuándo dejar de registrar operaciones en Hostinger. En el equipo nuevo abre Administración → Importar datos y selecciona el .algym. No se mezclan dos bases con operaciones.</p>
  </div>;
}
