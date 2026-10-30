"use client";

import { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Printer, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getDeviceOperation, getSaleReceipt, printSaleReceipt, type SaleReceipt } from "../actions/cash-receipt-actions";

const money = (value: number) => new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(value);

export function SaleDetailDialog({ id, byPayment = false }: { id: string; byPayment?: boolean }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<SaleReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [sent, setSent] = useState(false);
  const requestId = useRef<string | null>(null);
  const loadGeneration = useRef(0);

  async function changeOpen(next: boolean) {
    if (printing) return;
    setOpen(next);
    const generation = ++loadGeneration.current;
    if (!next) return;
    setDetail(null); setError(null); setSent(false);
    try {
      const receipt = await getSaleReceipt(id, byPayment);
      if (generation === loadGeneration.current) setDetail(receipt);
    } catch (cause) {
      if (generation === loadGeneration.current) setError(cause instanceof Error ? cause.message : "No se pudo cargar la venta");
    }
  }

  async function print() {
    if (!detail || printing) return;
    setPrinting(true); setError(null);
    requestId.current ??= uuidv4();
    try {
      const operation = await printSaleReceipt(detail.movementId, requestId.current);
      for (let attempt = 0; attempt < 45; attempt++) {
        const state = await getDeviceOperation(operation.id);
        if (state.status === "sent") {
          setSent(true); requestId.current = null; return;
        }
        if (!["pending", "dispatching"].includes(state.status)) {
          requestId.current = null;
          throw new Error(state.message || "No se pudo confirmar la impresión; revisa la impresora.");
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw new Error("La impresión aún no está confirmada. Revisa la impresora antes de volver a intentarlo.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo imprimir");
    } finally { setPrinting(false); }
  }

  return <Dialog open={open} onOpenChange={next => { void changeOpen(next); }}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><ReceiptText className="h-4 w-4" />Ver detalle</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Detalle de la venta</DialogTitle>
        <DialogDescription>Consulta el cobro y, si lo necesitas, imprime su recibo.</DialogDescription>
      </DialogHeader>
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {!detail && !error && <p className="text-sm text-muted-foreground">Cargando venta…</p>}
      {detail && <>
        <div className="space-y-4 rounded-xl border p-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xl font-bold">AlGym</p><p className="text-sm text-muted-foreground">Recibo de pago</p></div>
            <Badge variant={detail.status === "posted" ? "secondary" : "destructive"}>{detail.status === "posted" ? "Registrado" : "Anulado / reversado"}</Badge>
          </div>
          <p className="break-all font-mono text-xs text-muted-foreground">{detail.reference}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Fecha</dt><dd>{new Intl.DateTimeFormat("es-GT", { timeZone: "America/Guatemala", dateStyle: "medium", timeStyle: "short" }).format(new Date(detail.date))}</dd>
            <dt className="text-muted-foreground">Cliente</dt><dd>{detail.customer}</dd>
            <dt className="text-muted-foreground">Atendió</dt><dd>{detail.cashier}</dd>
            <dt className="text-muted-foreground">Pago</dt><dd>{detail.method === "cash" ? "Efectivo" : detail.method === "card" ? "Tarjeta" : "Transferencia"}</dd>
          </dl>
          <div className="divide-y border-y">{detail.items.map((item, index) => <div key={index} className="flex justify-between gap-4 py-3 text-sm">
            <div><p className="font-medium">{item.name}</p><p className="text-muted-foreground">{item.quantity} × {money(item.unitPrice)}</p></div>
            <span className="shrink-0 font-medium">{money(item.total)}</span>
          </div>)}</div>
          <div className="space-y-2 text-sm">
            <p className="flex justify-between"><span>Subtotal</span><span>{money(detail.subtotal)}</span></p>
            {detail.discount > 0 && <p className="flex justify-between"><span>Descuento</span><span>−{money(detail.discount)}</span></p>}
            <p className="flex justify-between text-lg font-bold"><span>Total cobrado</span><span>{money(detail.total)}</span></p>
          </div>
          {detail.note && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{detail.note}</p>}
        </div>
        {sent && <p role="status" className="text-sm text-green-700 dark:text-green-400">Recibo enviado a la impresora.</p>}
        <Button onClick={() => { void print(); }} disabled={printing} className="w-full">
          <Printer className="h-4 w-4" />{printing ? "Enviando recibo…" : sent ? "Imprimir otra copia" : "Imprimir recibo"}
        </Button>
      </>}
    </DialogContent>
  </Dialog>;
}
