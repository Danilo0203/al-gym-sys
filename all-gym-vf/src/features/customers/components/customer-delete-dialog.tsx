"use client";

import { useId, useState } from "react";
import { IconAlertTriangle, IconLoader2, IconTrash } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONFIRMATION_WORD = "ELIMINAR";

interface CustomerDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  loading: boolean;
  onConfirm: () => void;
}

export function CustomerDeleteDialog({
  open,
  onOpenChange,
  customerName,
  loading,
  onConfirm,
}: CustomerDeleteDialogProps) {
  const inputId = useId();
  const [confirmation, setConfirmation] = useState("");
  const confirmed = confirmation.trim().toUpperCase() === CONFIRMATION_WORD;

  const handleOpenChange = (next: boolean) => {
    if (loading) return;
    if (!next) setConfirmation("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden border-destructive/40 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 pr-8 text-xl text-destructive">
            <IconAlertTriangle className="size-6 shrink-0" />
            ¿Eliminar cliente permanentemente?
          </DialogTitle>
          <DialogDescription className="pt-1 text-base">
            Vas a eliminar a <span className="font-semibold text-foreground">{customerName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5 text-sm">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <p className="font-semibold">Esta acción es permanente y no se puede deshacer.</p>
            <p className="mt-1 text-destructive/90">
              No habrá forma de recuperar al cliente ni sus datos después de eliminarlo.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-medium">Se eliminará</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                <li>Datos personales y acceso a la app</li>
                <li>Membresías e inscripciones</li>
                <li>Rutinas y su progreso</li>
                <li>Asistencias y evaluaciones</li>
                <li>Su registro en el reloj biométrico</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">Se conservará</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                <li>Sus pagos</li>
                <li>Los movimientos de caja</li>
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">
                Seguirán apareciendo en los reportes con su nombre.
              </p>
            </div>
          </div>

          <p className="text-muted-foreground">
            Si solo quieres que deje de entrar al gimnasio, usa <span className="font-medium">Suspender</span>:
            conserva todo su historial y se puede revertir.
          </p>

          <div className="space-y-2">
            <Label htmlFor={inputId}>
              Escribe <span className="font-mono font-semibold">{CONFIRMATION_WORD}</span> para confirmar
            </Label>
            <Input
              id={inputId}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              disabled={loading}
              placeholder={CONFIRMATION_WORD}
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/10 px-6 py-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!confirmed || loading}>
            {loading ? <IconLoader2 className="size-4 animate-spin" /> : <IconTrash className="size-4" />}
            Eliminar permanentemente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
