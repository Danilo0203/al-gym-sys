"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconAlertCircle, IconArrowsExchange, IconCash, IconCreditCard, IconReceipt2, IconTransfer } from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { type PaymentMethod, voidProductSaleFromCashSession } from "@/features/cash/actions/cash-actions";

interface ReverseProductSaleDialogProps {
  productSaleId: string;
  saleNumber: string | null;
  totalAmount: number;
  paymentMethod: PaymentMethod | null;
  trigger: ReactNode;
}

function formatMoney(amount: number | null | undefined) {
  const safeAmount = typeof amount === "number" ? amount : 0;
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(safeAmount);
}

function getPaymentMethodLabel(method: PaymentMethod | null) {
  switch (method) {
    case "cash":
      return "Efectivo";
    case "card":
      return "Tarjeta";
    case "transfer":
      return "Transferencia";
    default:
      return "N/A";
  }
}

function getPaymentMethodIcon(method: PaymentMethod | null) {
  switch (method) {
    case "cash":
      return <IconCash className="h-4 w-4" />;
    case "card":
      return <IconCreditCard className="h-4 w-4" />;
    case "transfer":
      return <IconTransfer className="h-4 w-4" />;
    default:
      return <IconReceipt2 className="h-4 w-4" />;
  }
}

export function ReverseProductSaleDialog({ productSaleId, saleNumber, totalAmount, paymentMethod, trigger }: ReverseProductSaleDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await voidProductSaleFromCashSession({
          productSaleId,
          note,
        });
        setOpen(false);
        setNote("");
        router.refresh();
        toast.success("Venta anulada correctamente.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo anular la venta.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setNote("");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Anular venta de productos</DialogTitle>
          <DialogDescription>
            Esta acción revierte la venta completa y restaura el inventario de todos los productos incluidos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Venta</p>
              <p className="mt-2 text-sm font-semibold">{saleNumber || "Sin número"}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</p>
              <p className="mt-2 text-sm font-semibold">{formatMoney(totalAmount)}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Método</p>
              <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
                {getPaymentMethodIcon(paymentMethod)}
                {getPaymentMethodLabel(paymentMethod)}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Venta ID</p>
              <p className="mt-2 truncate text-sm font-medium">{productSaleId}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Observación de anulación</p>
            <Textarea
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Opcional: agrega el motivo de la anulación"
            />
          </div>

          <Alert>
            <IconAlertCircle className="h-4 w-4" />
            <AlertTitle>La venta quedará anulada</AlertTitle>
            <AlertDescription>
              Se creará un reverso en caja y se restaurarán las cantidades vendidas en inventario.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button className="min-w-40" variant="destructive" disabled={isPending} onClick={handleConfirm}>
              <IconArrowsExchange className="h-4 w-4" />
              Anular venta
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
