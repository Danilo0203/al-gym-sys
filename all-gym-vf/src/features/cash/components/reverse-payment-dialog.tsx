"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  IconAlertCircle,
  IconArrowsExchange,
  IconCash,
  IconCreditCard,
  IconReceipt2,
  IconTransfer,
} from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getPaymentReversalContext,
  reverseAndRecreatePayment,
  type CashPaymentReversalContext,
  type MovementCategory,
  type PaymentMethod,
} from "@/features/cash/actions/cash-actions";

interface ReversePaymentDialogProps {
  paymentId: string;
  sourceCategory: MovementCategory;
  trigger: ReactNode;
  conceptLabel?: string;
}

function formatMoney(amount: number | null | undefined) {
  const safeAmount = typeof amount === "number" ? amount : 0;
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(safeAmount);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Guatemala",
  }).format(new Date(value));
}

function getPaymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case "cash":
      return "Efectivo";
    case "card":
      return "Tarjeta";
    case "transfer":
      return "Transferencia";
    default:
      return method;
  }
}

function getPaymentMethodIcon(method: PaymentMethod) {
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

function formatDecimalInput(value: number) {
  return value.toFixed(2);
}

export function ReversePaymentDialog({
  paymentId,
  sourceCategory,
  trigger,
  conceptLabel = "Cobro",
}: ReversePaymentDialogProps) {
  const router = useRouter();
  const latestRequestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [context, setContext] = useState<CashPaymentReversalContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const resetState = () => {
    latestRequestRef.current += 1;
    setContext(null);
    setLoadError(null);
    setDiscountAmount("");
    setAmountPaid("");
    setPaymentMethod("cash");
    setReason("");
    setNote("");
    setConfirmOpen(false);
  };

  const loadContext = async () => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setIsLoadingContext(true);
    setLoadError(null);

    try {
      const paymentContext = await getPaymentReversalContext(paymentId);
      if (latestRequestRef.current !== requestId) return;

      if (!paymentContext) {
        setContext(null);
        setLoadError("No se encontro el pago a corregir.");
        return;
      }

      setContext(paymentContext);
      setDiscountAmount(formatDecimalInput(paymentContext.discount_amount));
      setAmountPaid(formatDecimalInput(paymentContext.amount_paid));
      setPaymentMethod(paymentContext.method);
    } catch (error) {
      if (latestRequestRef.current !== requestId) return;
      setContext(null);
      setLoadError(error instanceof Error ? error.message : "No se pudo cargar el pago.");
    } finally {
      if (latestRequestRef.current === requestId) {
        setIsLoadingContext(false);
      }
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      void loadContext();
      return;
    }

    resetState();
  };

  const parsedAmountPaid = Number(amountPaid);
  const parsedDiscountAmount = Number(discountAmount);
  const amountOriginal = context?.amount_original ?? 0;
  const isBlockedByStatus = Boolean(context && context.status !== "posted");

  const validateForm = () => {
    if (!context) {
      toast.error("No se pudo cargar el pago a corregir.");
      return false;
    }

    if (context.status !== "posted") {
      toast.error("Solo se pueden corregir pagos publicados.");
      return false;
    }

    if (!Number.isFinite(parsedDiscountAmount) || parsedDiscountAmount < 0) {
      toast.error("El descuento debe ser mayor o igual a 0.");
      return false;
    }

    if (!Number.isFinite(parsedAmountPaid) || parsedAmountPaid < 0) {
      toast.error("El monto a cobrar debe ser mayor o igual a 0.");
      return false;
    }

    if (!reason.trim()) {
      toast.error("Debes indicar el motivo del reverso.");
      return false;
    }

    return true;
  };

  const handleRequestConfirmation = () => {
    if (!validateForm()) {
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!context) {
      toast.error("No se pudo cargar el pago a corregir.");
      return;
    }

    startTransition(async () => {
      try {
        await reverseAndRecreatePayment({
          paymentId: context.payment_id,
          amountOriginal,
          discountAmount: parsedDiscountAmount,
          amountPaid: parsedAmountPaid,
          paymentMethod,
          reason,
          note,
          sourceCategory,
        });
        setConfirmOpen(false);
        setOpen(false);
        resetState();
        router.refresh();
        toast.success("Corrección registrada correctamente.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo corregir el cobro.");
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="flex max-h-[min(90vh,860px)] flex-col overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle>Corregir cobro</DialogTitle>
            <DialogDescription>
              Primero se anulará el pago original y luego se registrará un nuevo cobro corregido.
            </DialogDescription>
          </DialogHeader>

          {isLoadingContext ? (
            <div className="p-6">
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Cargando datos del cobro...
              </div>
            </div>
          ) : loadError ? (
            <div className="p-6">
              <Alert variant="destructive">
                <IconAlertCircle className="h-4 w-4" />
                <AlertTitle>No se pudo preparar la corrección</AlertTitle>
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            </div>
          ) : context ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-6">
                  <section className="rounded-2xl border bg-muted/20 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Paso 1</Badge>
                          <h3 className="text-sm font-semibold">Pago original</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Solo lectura. Este pago será anulado antes de registrar el nuevo cobro corregido.
                        </p>
                      </div>
                      <Badge variant={context.status === "posted" ? "success" : "destructive"}>
                        {context.status === "posted" ? "Publicado" : context.status || "Sin estado"}
                      </Badge>
                    </div>

                    <div className="mt-4 rounded-xl border bg-background/80 p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{context.user_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {context.plan_name || "Sin plan"} · {formatDateTime(context.payment_date)}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Monto</p>
                          <p className="mt-2 text-base font-semibold">{formatMoney(context.amount_paid)}</p>
                        </div>
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Método</p>
                          <p className="mt-2 inline-flex items-center gap-2 text-base font-semibold">
                            {getPaymentMethodIcon(context.method)}
                            {getPaymentMethodLabel(context.method)}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Concepto</p>
                          <p className="mt-2 text-base font-semibold">{conceptLabel}</p>
                        </div>
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pago ID</p>
                          <p className="mt-2 truncate text-sm font-medium">{context.payment_id}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {isBlockedByStatus ? (
                    <Alert variant="destructive">
                      <IconAlertCircle className="h-4 w-4" />
                      <AlertTitle>Pago no reversible</AlertTitle>
                      <AlertDescription>
                        Este pago ya no está publicado. Solo se pueden corregir pagos con estado `posted`.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <section className="rounded-2xl border p-5">
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Paso 2</Badge>
                            <h3 className="text-sm font-semibold">Nuevo cobro corregido</h3>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">Ingresa únicamente los datos del nuevo cobro.</p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Monto a cobrar</label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={amountPaid}
                              onChange={(event) => setAmountPaid(event.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Método de pago</label>
                            <select
                              value={paymentMethod}
                              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="cash">Efectivo</option>
                              <option value="card">Tarjeta</option>
                              <option value="transfer">Transferencia</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Descuento</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={discountAmount}
                            onChange={(event) => setDiscountAmount(event.target.value)}
                            placeholder="0.00"
                          />
                          <p className="text-xs text-muted-foreground">Opcional. Si no aplica, deja `0.00`.</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Motivo del reverso</label>
                          <Textarea
                            rows={4}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Explica por qué se corrige este cobro"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Nota operativa</label>
                          <Textarea
                            rows={3}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Nota opcional para el nuevo cobro"
                          />
                        </div>
                      </div>
                    </section>

                    <aside className="space-y-4">
                      <section className="rounded-2xl border bg-muted/20 p-5">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Paso 3</Badge>
                            <h3 className="text-sm font-semibold">Resultado esperado</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Esto es lo que quedará registrado cuando confirmes la corrección.
                          </p>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                          <div className="rounded-xl border bg-background p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Nuevo pago</p>
                            <p className="mt-2 text-2xl font-semibold">
                              {formatMoney(Number.isFinite(parsedAmountPaid) ? parsedAmountPaid : 0)}
                            </p>
                            <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                              {getPaymentMethodIcon(paymentMethod)}
                              {getPaymentMethodLabel(paymentMethod)}
                            </p>
                          </div>

                          <div className="rounded-xl border bg-background p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Acción</p>
                            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                              <p>El pago original será ANULADO.</p>
                              <p>Se registrará un nuevo cobro con los datos capturados.</p>
                            </div>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-2xl border p-5">
                        <p className="text-sm font-semibold">Referencia rápida</p>
                        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                          <p>Monto original: {formatMoney(context.amount_paid)}</p>
                          <p>Nuevo monto: {formatMoney(Number.isFinite(parsedAmountPaid) ? parsedAmountPaid : 0)}</p>
                          <p>Descuento aplicado: {formatMoney(Number.isFinite(parsedDiscountAmount) ? parsedDiscountAmount : 0)}</p>
                        </div>
                      </section>
                    </aside>
                  </div>
                </div>
              </div>

              <div className="border-t bg-background px-6 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    El pago original no se edita: se anula y se crea uno nuevo con los valores corregidos.
                  </p>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="button" disabled={isPending || isBlockedByStatus} onClick={handleRequestConfirmation}>
                      <IconArrowsExchange className="h-4 w-4" />
                      Confirmar corrección
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar corrección</AlertDialogTitle>
            <AlertDialogDescription>
              Se anulará el pago original y se creará uno nuevo por{" "}
              {formatMoney(Number.isFinite(parsedAmountPaid) ? parsedAmountPaid : 0)} ({getPaymentMethodLabel(paymentMethod)}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={handleConfirm}>
              Anular y crear nuevo cobro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
