"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileArchive, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

type Preview = { snapshotAt: string; sha256: string; customers: number; plans: number; memberships: number; payments: number; attendance: number; routines: number; images: number };
type Package = { id: string; token: string; preview: Preview };
type Job = { id: string; token: string };
const base = "/api/system/migration";
const storageKey = "algym-import-job";
async function jsonResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "No fue posible completar la operación.");
  return data;
}
export function MigrationImport() {
  const input = useRef<HTMLInputElement>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<Package | null>(null);
  const [filename, setFilename] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [result, setResult] = useState<"succeeded" | "failed" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = uploading || !!job;

  useEffect(() => {
    let live = true;
    fetch(base, { cache: "no-store" }).then(jsonResponse).then(data => {
      if (!live) return;
      setAvailable(data.available === true);
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
        if (saved?.id && saved?.token) setJob(saved);
      } catch { sessionStorage.removeItem(storageKey); }
    }).catch(e => { if (live) { setError(e.message); setAvailable(false); } });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!job) return;
    let live = true, timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    async function poll() {
      try {
        const response = await fetch(`${base}/jobs/${job!.id}/status`, {
          method: "POST", headers: { "x-algym-import-token": job!.token }, cache: "no-store",
        });
        if (response.status >= 400 && response.status < 500) {
          if (live) {
            setResult("failed"); setMessage("La consulta de esta importación expiró. Revisa el sistema antes de seleccionar otro archivo.");
            setJob(null); setSelected(null); sessionStorage.removeItem(storageKey);
          }
          return;
        }
        const data = await jsonResponse(response);
        if (!live) return;
        setMessage(data.message);
        if (data.state === "succeeded" || data.state === "failed") {
          if (data.state === "failed") { setSelected(null); setConfirmed(false); }
          setResult(data.state); setJob(null); sessionStorage.removeItem(storageKey); return;
        }
      } catch {
        if (!live) return;
        setMessage("El sistema está reiniciando sus servicios. Reconectando…");
      }
      if (!live) return;
      if (Date.now() - started > 15 * 60000) {
        setMessage("La comprobación está tardando más de lo esperado. Vuelve a abrir esta página para consultar el resultado; no vuelvas a importar todavía.");
        return;
      }
      timer = setTimeout(poll, 2500);
    }
    void poll();
    return () => { live = false; clearTimeout(timer); };
  }, [job]);

  async function select(file?: File) {
    if (!file || busy) return;
    setError(""); setResult(null); setSelected(null); setConfirmed(false);
    if (!file.name.toLowerCase().endsWith(".algym")) { setError("Selecciona el paquete de migración con extensión .algym."); return; }
    if (file.size > 256 * 1024 * 1024) { setError("El archivo supera el límite de 256 MB."); return; }
    setUploading(true); setFilename(file.name);
    try {
      const data = await jsonResponse(await fetch(`${base}/packages`, {
        method: "POST", headers: { "content-type": "application/octet-stream" }, body: file,
      }));
      setSelected(data);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo leer el archivo."); }
    finally { setUploading(false); }
  }
  async function start() {
    if (!selected || !confirmed || busy) return;
    setError("");
    const current = { id: selected.id, token: selected.token };
    // Persist before dispatch; an accepted request may lose its HTTP response as services stop.
    sessionStorage.setItem(storageKey, JSON.stringify(current));
    setJob(current); setMessage("Preparando la importación…");
    try {
      const response = await fetch(`${base}/packages/${selected.id}/import`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true, sha256: selected.preview.sha256 }),
      });
      if (response.status < 500) await jsonResponse(response);
      // A 5xx during the service restart is resolved by status polling.
    } catch (e) {
      if (e instanceof TypeError) return;
      setError(e instanceof Error ? e.message : "No se pudo iniciar la importación.");
      setJob(null); sessionStorage.removeItem(storageKey);
    }
  }
  const counts: [string, number][] = selected ? [
    ["Clientes", selected.preview.customers], ["Planes", selected.preview.plans],
    ["Membresías", selected.preview.memberships], ["Pagos", selected.preview.payments],
    ["Asistencias", selected.preview.attendance], ["Rutinas", selected.preview.routines],
  ] : [];
  return <div className="mx-auto w-full max-w-3xl space-y-6 pb-8">
    <Card>
      <CardHeader><CardTitle>Importar respaldo de Hostinger</CardTitle>
        <CardDescription>Selecciona el paquete preparado para tu gimnasio. Verás su fecha y contenido antes de cargar los datos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {available === false && <p className="rounded-lg border p-4 text-sm">La importación requiere AlGym para Windows 0.3.0 o posterior y su servicio activo.</p>}
        <input ref={input} type="file" accept=".algym" className="hidden" aria-label="Seleccionar respaldo AlGym"
          onChange={event => { void select(event.target.files?.[0]); event.target.value = ""; }} />
        <button type="button" disabled={busy || available !== true || result === "succeeded"}
          onClick={() => input.current?.click()}
          onDragOver={event => event.preventDefault()}
          onDrop={event => { event.preventDefault(); if (!busy && available && result !== "succeeded") {
            if (event.dataTransfer.files.length !== 1) setError("Arrastra un solo archivo .algym.");
            else void select(event.dataTransfer.files[0]);
          } }}
          className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:bg-muted/50 disabled:cursor-wait disabled:opacity-60">
          {uploading ? <Loader2 className="size-10 animate-spin text-primary" /> : <UploadCloud className="size-10 text-primary" />}
          <span className="font-medium">{uploading ? "Comprobando el respaldo…" : "Arrastra aquí tu archivo .algym"}</span>
          <span className="text-sm text-muted-foreground">o pulsa para seleccionarlo · máximo 256 MB</span>
        </button>
        {error && <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="size-5 shrink-0" />{error}</p>}
        {selected && <div className="space-y-4">
          <div className="flex gap-3"><FileArchive className="size-5 shrink-0 text-muted-foreground" /><div className="min-w-0">
            <p className="break-all text-sm font-medium">{filename}</p>
            <p className="text-sm text-muted-foreground">Datos del {new Date(selected.preview.snapshotAt).toLocaleString("es-GT", { dateStyle: "long", timeStyle: "short" })}</p>
          </div></div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">{counts.map(([label, total]) => <div key={label} className="rounded-lg border p-3">
            <dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold">{total.toLocaleString("es-GT")}</dd>
          </div>)}</dl>
          <p className="text-sm text-muted-foreground">Se guardará un respaldo local. Las cuentas de Hostinger sustituirán la cuenta inicial del equipo. El envío al reloj quedará pausado.</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} disabled={busy || result === "succeeded"} />
            <span>Confirmo que este es el respaldo correcto. Entiendo que solo se puede cargar en una instalación nueva; repetir el mismo respaldo no duplica los datos.</span>
          </label>
          <Button onClick={() => void start()} disabled={!confirmed || busy || result === "succeeded"} className="w-full sm:w-auto">
            {job && <Loader2 className="mr-2 size-4 animate-spin" />}Importar datos
          </Button>
        </div>}
        {(job || result) && <div role="status" aria-live="polite" className="space-y-3 rounded-xl border p-5">
          <div className="flex items-center gap-2 font-medium">{result === "succeeded" ? <CheckCircle2 className="size-5 text-green-600" /> : result === "failed" ? <AlertCircle className="size-5 text-destructive" /> : <Loader2 className="size-5 animate-spin" />}
            {result === "succeeded" ? "Datos listos" : result === "failed" ? "Importación pendiente" : "Importación en curso"}</div>
          <p className="text-sm text-muted-foreground">{message}</p>
          {result === "succeeded" && <Button asChild><a href="/iniciar-sesion">Entrar al sistema</a></Button>}
        </div>}
      </CardContent>
    </Card>
    <p className="text-sm text-muted-foreground">Esta función importa una copia. Los cambios posteriores en Hostinger no se sincronizan automáticamente y una instalación con operaciones no se sobrescribe.</p>
  </div>;
}
