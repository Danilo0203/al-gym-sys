"use client";

import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Banknote, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getCashDeviceStatus, getDeviceOperation, openCashDrawer, type CashDeviceStatus } from "../actions/cash-receipt-actions";

export function CashDrawerControl() {
  const [data, setData] = useState<CashDeviceStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.hidden) return;
      try { const status = await getCashDeviceStatus(); if (active) setData(status); }
      catch { if (active) setMessage("No se pudo consultar el cajón. Los cobros siguen disponibles."); }
    }
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 5000);
    return () => { active = false; clearInterval(interval); };
  }, []);
  async function send() {
    if (busy || reason.trim().length < 3) return;
    setBusy(true); setMessage(null);
    requestId.current ??= uuidv4();
    try {
      const operation = await openCashDrawer(requestId.current, reason);
      for (let attempt = 0; attempt < 45; attempt++) {
        const state = await getDeviceOperation(operation.id);
        if (state.status === "sent") {
          requestId.current = null; setMessage("Orden de apertura enviada."); setOpen(false); setReason(""); return;
        }
        if (!["pending", "dispatching"].includes(state.status)) {
          requestId.current = null; throw new Error(state.message || "Comprueba el cajón antes de reintentar.");
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw new Error("La orden aún no está confirmada. Comprueba el cajón.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No se pudo abrir el cajón"); }
    finally { setBusy(false); }
  }
  const lastDrawer = data?.operations.find(item => item.kind.startsWith("drawer"));
  const failed = lastDrawer && ["failed", "expired", "unknown"].includes(lastDrawer.status);
  return <div className="space-y-2 rounded-xl border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Banknote className="h-5 w-5 text-muted-foreground" />
        <div><p className="font-medium">Cajón de dinero</p><p className="text-sm text-muted-foreground">
          {data?.automaticDrawer ? "Apertura automática al confirmar cobros en efectivo." : data ? "Apertura automática desactivada." : "Consultando conexión…"}
        </p></div>
      </div>
      <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
        <DialogTrigger asChild><Button variant="outline" disabled={!data?.automaticDrawer}>Abrir cajón</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Abrir cajón de dinero</DialogTitle>
            <DialogDescription>Indica el motivo. Esta apertura quedará registrada a tu nombre.</DialogDescription></DialogHeader>
          <label htmlFor="drawer-reason" className="text-sm">Motivo de apertura</label>
          <Input id="drawer-reason" maxLength={200} value={reason} onChange={event => setReason(event.target.value)} placeholder="Por ejemplo, dar cambio" />
          {message && <p role="status" className="text-sm">{message}</p>}
          <Button disabled={busy || reason.trim().length < 3} onClick={() => { void send(); }}>{busy ? "Enviando orden…" : "Abrir cajón"}</Button>
        </DialogContent>
      </Dialog>
    </div>
    {failed && <p role="alert" className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />El cobro quedó registrado, pero la apertura no está confirmada. {lastDrawer.message}
    </p>}
    {message && !open && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
  </div>;
}
