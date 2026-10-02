"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getPaymentDetail, type PaymentDetail } from "@/features/payments/actions/get-payments";

const money = (value: number) => `Q${value.toFixed(2)}`;

export function PaymentDetailDialog({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) return;
    setDetail(null);
    setError(null);
    void getPaymentDetail(paymentId)
      .then(setDetail)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Error al cargar el pago"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button variant="outline" size="sm">Detalle</Button></DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Detalle del pago</DialogTitle>
          <DialogDescription>Registro y estado guardados en la base de datos local.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!detail && !error && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {detail && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt>Cliente</dt><dd className="font-medium">{detail.user_name}</dd>
            <dt>Fecha</dt><dd>{format(new Date(detail.payment_date), "dd MMM yyyy, HH:mm", { locale: es })}</dd>
            <dt>Estado</dt><dd>{detail.status === "reversed" ? "Reversado" : "Publicado"}</dd>
            <dt>Plan</dt><dd>{detail.plan_name}</dd>
            <dt>Método</dt><dd>{detail.method === "cash" ? "Efectivo" : detail.method === "card" ? "Tarjeta" : "Transferencia"}</dd>
            <dt>Importe original</dt><dd>{money(detail.amount_original)}</dd>
            <dt>Descuento</dt><dd>{money(detail.discount_amount)}</dd>
            <dt>Total cobrado</dt><dd className="font-semibold">{money(detail.amount_paid)}</dd>
            {detail.notes && <><dt>Nota</dt><dd>{detail.notes}</dd></>}
            {detail.reversed_at && <><dt>Reversado el</dt><dd>{format(new Date(detail.reversed_at), "dd MMM yyyy, HH:mm", { locale: es })}</dd></>}
            {detail.reversal_reason && <><dt>Motivo</dt><dd>{detail.reversal_reason}</dd></>}
            {detail.replacement_payment_id && <><dt>Pago de reemplazo</dt><dd className="break-all font-mono text-xs">{detail.replacement_payment_id}</dd></>}
            <dt>ID del pago</dt><dd className="break-all font-mono text-xs">{detail.id}</dd>
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}
