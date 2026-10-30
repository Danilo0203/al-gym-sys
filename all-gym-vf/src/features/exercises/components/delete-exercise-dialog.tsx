"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { deleteExerciseCatalogItem } from "../actions/exercise-actions";

export function DeleteExerciseDialog({ id, name }: { id: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <AlertDialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
    <AlertDialogTrigger asChild><Button type="button" variant="outline" size="icon" title="Eliminar ejercicio" aria-label={`Eliminar ${name}`} className="text-destructive"><Trash2 /></Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>¿Eliminar «{name}»?</AlertDialogTitle>
        <AlertDialogDescription>Se quitará del catálogo y de la selección para nuevas rutinas. Las rutinas que ya lo incluyen conservarán el ejercicio y su archivo.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
        <Button variant="destructive" disabled={pending} onClick={() => startTransition(async () => {
          const result = await deleteExerciseCatalogItem(id);
          if (!result.success) { toast.error(result.error); return; }
          setOpen(false); toast.success("Ejercicio eliminado del catálogo"); router.refresh();
        })}>{pending ? "Eliminando…" : "Eliminar ejercicio"}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
