"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Check, FolderOpen, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EXERCISE_MEDIA_ACCEPT } from "@/lib/training/exercise-media";
import { createExerciseCatalogItem } from "../actions/exercise-actions";
import { prepareExerciseBatch, uploadExerciseBatch, validateExerciseBatch, type ExerciseBatchItem } from "../lib/exercise-batch";

export function ExerciseBatchUpload({ existingNames }: { existingNames: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ExerciseBatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const [reading, setReading] = useState(false);
  const busy = useRef(false);
  const stop = useRef(false);
  const folderInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (busy.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => { stop.current = true; window.removeEventListener("beforeunload", warn); };
  }, []);

  const addFiles = (files: File[]) => {
    setReading(false);
    if (busy.current) return;
    if (!files.length) { toast.info("La carpeta está vacía o no contiene archivos accesibles."); return; }
    setItems((current) => [...current, ...prepareExerciseBatch(files)]);
  };
  const { getRootProps, isDragActive } = useDropzone({
    noClick: true, noKeyboard: true, multiple: true,
    disabled: running || reading,
    onDrop: addFiles,
    onError: () => { setReading(false); toast.error("No se pudo leer la carpeta. Prueba seleccionando los archivos."); },
  });
  const errors = validateExerciseBatch(items, existingNames);
  const pending = items.filter((item) => item.status === "pending" && !errors.has(item.id));
  const savedCount = items.filter((item) => item.status === "success").length;
  const failedCount = items.filter((item) => item.status === "error").length;
  const omittedCount = items.filter((item) => item.status === "pending" && errors.has(item.id)).length;
  const locked = running || reading;

  const startUpload = async () => {
    if (busy.current || !pending.length) return;
    busy.current = true;
    stop.current = false;
    setRunning(true);
    setStopping(false);
    try {
      const result = await uploadExerciseBatch(pending, createExerciseCatalogItem, (id, status, error) => {
        setItems((current) => current.map((item) => item.id === id ? { ...item, status, error } : item));
      }, () => stop.current);
      if (result.saved) toast.success(`${result.saved} ejercicios guardados.`);
      if (result.failed) toast.error(`${result.failed} archivos no se pudieron guardar. Revisa el detalle.`);
      router.refresh();
    } finally {
      busy.current = false;
      setRunning(false);
      setStopping(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!busy.current && !reading) setOpen(value); }}>
      <DialogTrigger asChild><Button variant="outline"><Upload />Subir varios archivos</Button></DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Subir ejercicios por lote</DialogTitle>
          <DialogDescription>
            Cada archivo crea un ejercicio con su nombre, sin la extensión. Puedes corregirlo antes de subir.
            Los nombres repetidos se omiten; no se reemplazan ejercicios existentes.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto">
          <div {...getRootProps({
            onDropCapture: () => { if (!locked) setReading(true); },
            className: `rounded-lg border-2 border-dashed p-6 text-center ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30"}`,
            "aria-label": "Arrastra una carpeta o varios archivos de ejercicios",
          })}>
            <FolderOpen className="text-muted-foreground mx-auto mb-2 size-8" />
            <p className="font-medium">Arrastra aquí una carpeta o varios archivos</p>
            <p className="text-muted-foreground mt-1 text-sm">Incluye subcarpetas. JPG, PNG, WEBP y GIF: hasta 5 MB. MP4: hasta 20 MB.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="outline" disabled={locked} onClick={() => fileInput.current?.click()}><Upload />Seleccionar archivos</Button>
              <Button variant="outline" disabled={locked} onClick={() => folderInput.current?.click()}><FolderOpen />Seleccionar carpeta</Button>
            </div>
            <input ref={fileInput} type="file" multiple accept={EXERCISE_MEDIA_ACCEPT} className="hidden" aria-label="Seleccionar archivos de ejercicios" onChange={(event) => {
              addFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = "";
            }} />
            <input ref={(input) => { folderInput.current = input; input?.setAttribute("webkitdirectory", ""); }} type="file" multiple className="hidden" aria-label="Seleccionar carpeta de ejercicios" onChange={(event) => {
              addFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = "";
            }} />
            {reading && <p role="status" className="mt-3 text-sm">Leyendo archivos de la carpeta…</p>}
          </div>
          {items.length > 0 && <>
            <p role="status" aria-live="polite" className="text-muted-foreground text-sm">
              {items.length} archivos · {savedCount} guardados · {pending.length} pendientes · {omittedCount} omitidos · {failedCount} con error
            </p>
            {running && <p className="text-sm">Mantén esta ventana abierta mientras se guardan los archivos.</p>}
            <ul className="divide-y rounded-lg border">
              {items.slice(0, visibleCount).map((item) => {
                const problem = item.error || errors.get(item.id);
                return <li key={item.id} className="space-y-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground mb-1 truncate text-xs" title={item.path}>{item.path}</p>
                      <Input aria-label={`Nombre del ejercicio para ${item.path}`} value={item.name} disabled={locked || item.status !== "pending"} onChange={(event) => {
                        const name = event.target.value;
                        setItems((current) => current.map((row) => row.id === item.id ? { ...row, name } : row));
                      }} />
                    </div>
                    {item.status === "success" ? <Check className="size-5 text-green-600" aria-label="Guardado" />
                      : item.status === "uploading" ? <Loader2 className="size-5 animate-spin" aria-label="Guardando" />
                      : <Button size="icon" variant="ghost" disabled={locked} aria-label={`Quitar ${item.path}`} onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}><X /></Button>}
                  </div>
                  {item.status === "success" ? <p className="text-sm text-green-600">Guardado</p>
                    : problem && <p className="text-destructive text-sm">{item.status === "error" ? "Error" : "No se subirá"}: {problem}</p>}
                </li>;
              })}
            </ul>
            {items.length > visibleCount && <Button variant="ghost" onClick={() => setVisibleCount((count) => count + 50)}>Ver más archivos ({items.length - visibleCount})</Button>}
            {failedCount > 0 && <p className="text-muted-foreground text-sm">Si se interrumpió la conexión, revisa el catálogo antes de volver a agregar los archivos con error.</p>}
          </>}
        </div>
        <DialogFooter className="flex-wrap">
          {!locked && items.length > 0 && <Button variant="ghost" onClick={() => { setItems([]); setVisibleCount(50); }}>Limpiar lista</Button>}
          <Button variant="outline" disabled={locked} onClick={() => setOpen(false)}>Cerrar</Button>
          {running ? <Button variant="outline" disabled={stopping} onClick={() => { stop.current = true; setStopping(true); }}>{stopping ? "Terminando archivo actual…" : "Detener después del actual"}</Button>
            : <Button disabled={reading || !pending.length} onClick={startUpload}><Upload />Subir {pending.length} ejercicios</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
