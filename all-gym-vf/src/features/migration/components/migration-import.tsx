"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileArchive, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

type Totals = { inserted: number; updated: number; retained: number; unchanged: number; duplicates: number; ignoredDeletions: number };
type Review = { canApply: boolean; alreadyApplied?: boolean; totals: Totals; tables: (Totals & {table: string})[]; conflicts: {table: string; reason: string; count: number}[] };
type Preview = { snapshotAt: string; sha256: string; customers: number; plans: number; memberships: number; payments: number; attendance: number; routines: number; images: number };
type Package = { id: string; token: string; preview: Preview };
type Job = { id: string; token: string; mode?: "initial" | "review" | "update" };
const base = "/api/system/migration", storageKey = "algym-import-job";
const labels: Record<string, string> = {
  "auth.users":"Cuentas", "auth.identities":"Accesos", "public.profiles":"Personas", "public.plans":"Planes",
  "public.payments":"Pagos", "public.subscriptions":"Membresías", "public.attendance_logs":"Asistencias",
  "public.access_logs":"Entradas", "public.routines":"Rutinas", "public.routine_details":"Ejercicios de rutinas",
  "public.exercises":"Ejercicios", "public.products":"Productos", "public.product_sales":"Ventas",
  "public.product_sale_items":"Detalle de ventas", "public.inventory_movements":"Movimientos de inventario",
  "public.cash_sessions":"Sesiones de caja", "public.cash_movements":"Movimientos de caja", "public.cash_registers":"Cajas",
  "public.body_assessments":"Evaluaciones", "public.training_profiles":"Perfiles de entrenamiento",
  "public.training_nutrition_snapshots":"Evaluaciones nutricionales", "public.routine_blueprints":"Plantillas de rutinas",
  "public.routine_blueprint_details":"Detalle de plantillas", "public.routine_blueprint_assignments":"Asignaciones de rutinas",
  "public.routine_templates":"Plantillas", "public.message_templates":"Mensajes",
};
const reasons: Record<string, string> = {
  changed_both:"Cambió en Hostinger y también en este equipo.", possible_duplicate:"Puede ser un registro ya capturado con otro identificador.",
  id_collision:"El mismo identificador corresponde a datos distintos.", changed_after_local_deletion:"Fue eliminado aquí y modificado en Hostinger.",
  local_related_activity:"Tiene operaciones locales relacionadas que requieren revisión.", protected_account:"Requiere revisar una nueva cuenta de personal.",
  protected_account_or_clock:"Cambiaría permisos, estado de una cuenta o su identificación en el reloj.",
  different_clock_event:"La asistencia coincide, pero sus detalles son diferentes.", clock_commands:"El respaldo contiene órdenes antiguas del reloj.",
  constraint:"La combinación no cumple una regla de integridad del sistema.",
};
async function jsonResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "No fue posible completar la operación.");
  return data;
}
export function MigrationImport() {
  const input = useRef<HTMLInputElement>(null), baselineInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"initial" | "update">("update");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<Package | null>(null), [baseline, setBaseline] = useState<Package | null>(null);
  const [filename, setFilename] = useState(""), [baselineName, setBaselineName] = useState("");
  const [review, setReview] = useState<Review | null>(null), [confirmed, setConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false), [job, setJob] = useState<Job | null>(null);
  const [result, setResult] = useState<"succeeded" | "failed" | null>(null), [message, setMessage] = useState(""), [error, setError] = useState("");
  const busy = uploading || !!job;

  useEffect(() => {
    let live = true;
    fetch(base, {cache:"no-store"}).then(jsonResponse).then(data => {
      if (!live) return;
      setAvailable(data.available === true);
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
        if (saved?.id && saved?.token) { setJob(saved); setMode(saved.mode === "initial" ? "initial" : "update"); }
      } catch { sessionStorage.removeItem(storageKey); }
    }).catch(e => { if (live) { setError(e.message); setAvailable(false); } });
    return () => { live=false; };
  }, []);
  useEffect(() => {
    if (!job) return;
    let live=true, timer: ReturnType<typeof setTimeout>;
    const started=Date.now();
    async function poll() {
      try {
        const response=await fetch(`${base}/jobs/${job!.id}/status`, {method:"POST",headers:{"x-algym-import-token":job!.token},cache:"no-store"});
        if (response.status >= 400 && response.status < 500) throw new Error("La consulta expiró. Revisa el sistema antes de cargar otro respaldo.");
        const data=await jsonResponse(response);
        if (!live) return;
        setMessage(data.message);
        if (data.state === "reviewed") {
          setReview(data.review); setConfirmed(false); setJob(null); sessionStorage.removeItem(storageKey);
          if (!selected) setError("La comparación terminó. Selecciona de nuevo los archivos para confirmar desde esta página.");
          return;
        }
        if (data.state === "succeeded" || data.state === "failed") {
          if (data.state === "failed") { setSelected(null); setReview(null); setConfirmed(false); }
          setResult(data.state); setJob(null); sessionStorage.removeItem(storageKey); return;
        }
      } catch {
        if (!live) return;
        setMessage("Esperando la conexión con el sistema. No repitas la operación todavía…");
      }
      if (!live) return;
      if (Date.now()-started > 15*60000) { setMessage("La comprobación está tardando. Vuelve a abrir esta página para consultar el resultado antes de reintentar."); return; }
      timer=setTimeout(poll,2500);
    }
    void poll(); return () => { live=false; clearTimeout(timer); };
  }, [job, selected]);

  async function select(file?: File, original=false) {
    if (!file || busy) return;
    setError(""); setResult(null); setReview(null); setConfirmed(false);
    if (!file.name.toLowerCase().endsWith(".algym") || file.size > 256*1024*1024) { setError("Selecciona un archivo .algym de hasta 256 MB."); return; }
    setUploading(true);
    try {
      const data=await jsonResponse(await fetch(`${base}/packages`, {method:"POST",headers:{"content-type":"application/octet-stream"},body:file}));
      if (original) { setBaseline(data); setBaselineName(file.name); setSelected(null); }
      else { setSelected(data); setFilename(file.name); }
    } catch(e) { setError(e instanceof Error ? e.message : "No se pudo leer el archivo."); }
    finally { setUploading(false); }
  }
  function track(current: Job) { sessionStorage.setItem(storageKey,JSON.stringify(current)); setJob(current); }
  async function start(action: "initial" | "review" | "update") {
    if (!selected || busy || (action !== "review" && !confirmed)) return;
    setError(""); setResult(null);
    const current: Job={id:selected.id,token:selected.token,mode:action};
    if (action !== "update") track(current); else setUploading(true);
    setMessage(action === "review" ? "Comparando con los datos locales…" : "Preparando el respaldo y la carga…");
    try {
      const suffix=action === "initial" ? "import" : action;
      const body=action === "review" ? {sha256:selected.preview.sha256,baselineId:baseline?.id} : {confirmed:true,sha256:selected.preview.sha256};
      const response=await fetch(`${base}/packages/${selected.id}/${suffix}`, {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      if (response.status>=500 && action!=="update") return;
      const data=await jsonResponse(response);
      if (action === "update") track({...data,mode:"update"});
    } catch(e) {
      if (action !== "update" && e instanceof TypeError) return;
      setError(e instanceof Error ? e.message : "No se pudo iniciar. Puedes reintentar; se comprobará la operación existente.");
      setJob(null); sessionStorage.removeItem(storageKey);
    } finally { setUploading(false); }
  }
  const counts: [string,number][] = selected ? [["Clientes",selected.preview.customers],["Planes",selected.preview.plans],["Membresías",selected.preview.memberships],["Pagos",selected.preview.payments],["Asistencias",selected.preview.attendance],["Rutinas",selected.preview.routines]] : [];
  return <div className="mx-auto w-full max-w-3xl space-y-6 pb-8">
    <Card><CardHeader><CardTitle>Importar datos de Hostinger</CardTitle>
      <CardDescription>Carga una copia .algym. Una actualización conserva las operaciones de este equipo y revisa los conflictos antes de aplicar.</CardDescription>
    </CardHeader><CardContent className="space-y-6">
      <div className="flex flex-wrap gap-2">{([["update","Actualizar este equipo"],["initial","Primera importación"]] as const).map(([value,label]) =>
        <Button key={value} variant={mode===value ? "default" : "outline"} disabled={busy} onClick={()=>{setMode(value);setSelected(null);setReview(null);setConfirmed(false);setResult(null);setError("");}}>{label}</Button>)}</div>
      {available===false && <p className="rounded-lg border p-4 text-sm">Esta función requiere la versión de AlGym para Windows con actualización de datos y su servicio activo.</p>}
      {mode==="update" && <div className="space-y-3 rounded-lg border p-4">
        <p className="font-medium">Respaldo original, solo para la primera actualización</p>
        <p className="text-sm text-muted-foreground">Selecciona primero el mismo .algym que importaste al instalar. Después de una actualización correcta, el sistema conservará la referencia y podrás omitirlo.</p>
        <input ref={baselineInput} type="file" accept=".algym" className="hidden" aria-label="Seleccionar respaldo original" onChange={e=>{void select(e.target.files?.[0],true);e.target.value="";}} />
        <Button variant="outline" disabled={busy || available!==true} onClick={()=>baselineInput.current?.click()}>Seleccionar respaldo original</Button>
        {baseline && <p className="break-all text-sm">{baselineName}</p>}
      </div>}
      <input ref={input} type="file" accept=".algym" className="hidden" aria-label="Seleccionar respaldo actualizado" onChange={e=>{void select(e.target.files?.[0]);e.target.value="";}} />
      <button type="button" disabled={busy || available!==true || result==="succeeded"} onClick={()=>input.current?.click()}
        onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy&&available&&result!=="succeeded"){if(e.dataTransfer.files.length!==1)setError("Arrastra un solo archivo .algym.");else void select(e.dataTransfer.files[0]);}}}
        className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:bg-muted/50 disabled:cursor-wait disabled:opacity-60">
        {uploading ? <Loader2 className="size-10 animate-spin text-primary"/> : <UploadCloud className="size-10 text-primary"/>}
        <span className="font-medium">{uploading ? "Comprobando el archivo…" : mode==="update" ? "Arrastra aquí el .algym actualizado" : "Arrastra aquí tu archivo .algym"}</span>
        <span className="text-sm text-muted-foreground">o pulsa para seleccionarlo · máximo 256 MB</span>
      </button>
      {error && <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="size-5 shrink-0"/>{error}</p>}
      {selected && <div className="space-y-4">
        <div className="flex gap-3"><FileArchive className="size-5 shrink-0 text-muted-foreground"/><div className="min-w-0"><p className="break-all text-sm font-medium">{filename}</p>
          <p className="text-sm text-muted-foreground">Copia del {new Date(selected.preview.snapshotAt).toLocaleString("es-GT",{dateStyle:"long",timeStyle:"short"})}</p></div></div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">{counts.map(([label,total])=><div key={label} className="rounded-lg border p-3"><dt className="text-sm text-muted-foreground">{label} en la copia</dt><dd className="mt-1 text-xl font-semibold">{total.toLocaleString("es-GT")}</dd></div>)}</dl>
        {mode==="update" && !review && <Button disabled={busy} onClick={()=>void start("review")}>Comparar con este equipo</Button>}
        {mode==="update" && review && <div className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">{review.alreadyApplied ? "Esta copia ya fue aplicada" : "Resultado de la comparación"}</h3>
          <p className="text-sm">Nuevos: {review.totals.inserted} · Cambios compatibles: {review.totals.updated} · Repetidos reconocidos: {review.totals.duplicates}</p>
          <p className="text-sm text-muted-foreground">Los registros exclusivos de este equipo se conservan. Las eliminaciones de Hostinger no borran el historial local.</p>
          {review.tables.filter(t=>t.inserted||t.updated).map(t=><p key={t.table} className="text-sm">{labels[t.table]??"Otros registros"}: {t.inserted} nuevos, {t.updated} cambios</p>)}
          {review.conflicts.length>0 && <div role="alert" className="space-y-2 text-sm text-destructive">
            <p className="font-medium">No se puede aplicar todavía. No se modificaron datos.</p>
            {review.conflicts.map(c=><p key={c.table+c.reason}>{labels[c.table]??"Registros relacionados"} ({c.count}): {reasons[c.reason]??"Requiere revisión antes de combinar."}</p>)}
            <p>Conserva ambas copias para revisar estos casos. No borres registros para forzar la actualización.</p>
          </div>}
        </div>}
        {(mode==="initial" || review?.canApply) && <>
          <p className="text-sm text-muted-foreground">Se guardará un respaldo local y se pausará el sistema durante la carga. El envío de órdenes al reloj seguirá pausado.</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm"><Checkbox checked={confirmed} onCheckedChange={value=>setConfirmed(value===true)} disabled={busy||result==="succeeded"}/>
            <span>{mode==="update" ? "Revisé la comparación y confirmo que se aplique esta actualización conservando los datos locales." : "Confirmo que esta instalación no tiene operaciones. Las cuentas del respaldo sustituirán la cuenta inicial."}</span></label>
          <Button disabled={!confirmed||busy||result==="succeeded"} onClick={()=>void start(mode==="update"?"update":"initial")}>{mode==="update" ? "Aplicar actualización" : "Importar datos"}</Button>
        </>}
      </div>}
      {(job||result) && <div role="status" aria-live="polite" className="space-y-3 rounded-xl border p-5"><div className="flex items-center gap-2 font-medium">
        {result==="succeeded"?<CheckCircle2 className="size-5 text-green-600"/>:result==="failed"?<AlertCircle className="size-5 text-destructive"/>:<Loader2 className="size-5 animate-spin"/>}
        {result==="succeeded"?"Datos listos":result==="failed"?"Operación pendiente":"Operación en curso"}</div><p className="text-sm text-muted-foreground">{message}</p>
        {result==="succeeded" && <Button asChild><a href={mode==="update"?"/panel":"/iniciar-sesion"}>Entrar al sistema</a></Button>}</div>}
    </CardContent></Card>
    <p className="text-sm text-muted-foreground">Las actualizaciones son manuales. Un posible duplicado o un cambio hecho en ambos equipos requiere revisión; nunca se decide solo por la fecha del archivo.</p>
  </div>;
}
