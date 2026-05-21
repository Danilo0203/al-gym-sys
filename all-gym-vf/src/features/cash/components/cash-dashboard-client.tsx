"use client";

import { gsap } from "gsap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { IconAlertCircle, IconArrowsExchange, IconClock, IconDoorExit, IconLogin2, IconRefresh, IconUserPlus } from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CustomerFormSheet } from "@/features/customers/components/customer-form-sheet";
import { closeCashSession, ensureDefaultCashRegister, type CashDashboardData, openCashSession } from "@/features/cash/actions/cash-actions";
import { CashCustomerPaymentDialog } from "@/features/cash/components/cash-customer-payment-dialog";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";
import { QuickProductSalePanel } from "@/features/cash/components/quick-product-sale-panel";
import { ReversePaymentDialog } from "@/features/cash/components/reverse-payment-dialog";
import { ReverseProductSaleDialog } from "@/features/cash/components/reverse-product-sale-dialog";

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

function getSessionStatusBadgeVariant(status: string) {
  switch (status) {
    case "open":
      return "default";
    case "closed":
      return "secondary";
    case "closed_with_difference":
      return "destructive";
    default:
      return "outline";
  }
}

function getSessionStatusLabel(status: string) {
  switch (status) {
    case "open":
      return "Abierta";
    case "closed":
      return "Cerrada";
    case "closed_with_difference":
      return "Cerrada con diferencia";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
}

function SummarySessionCard({
  sessionNumber,
  status,
  registerName,
  openedAt,
  openedByName,
}: {
  sessionNumber: string;
  status: string;
  registerName: string;
  openedAt: string;
  openedByName: string;
}) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getSessionStatusBadgeVariant(status)} className="h-6 px-2 text-[11px]">
            {getSessionStatusLabel(status)}
          </Badge>
          <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            Caja {registerName}
          </span>
        </div>

        <div className="space-y-0.5">
          <p className="text-[0.62rem] uppercase tracking-[0.26em] text-muted-foreground">Sesión activa</p>
          <h3 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{sessionNumber}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[480px] xl:max-w-[560px]">
        <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
          <p className="text-[0.62rem] uppercase tracking-[0.26em] text-muted-foreground">Cajero</p>
          <p className="mt-1 truncate text-sm font-semibold leading-tight">{openedByName}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
          <p className="text-[0.62rem] uppercase tracking-[0.26em] text-muted-foreground">Apertura</p>
          <p className="mt-1 truncate text-sm font-semibold leading-tight">{formatDateTime(openedAt)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
          <p className="text-[0.62rem] uppercase tracking-[0.26em] text-muted-foreground">Estado</p>
          <p className="mt-1 truncate text-sm font-semibold leading-tight">{getSessionStatusLabel(status)}</p>
        </div>
      </div>
    </div>
  );
}

function getMovementTypeLabel(movementType: CashDashboardData["activityMovements"][number]["movement_type"]) {
  switch (movementType) {
    case "sale":
      return "Cobro";
    case "manual_income":
      return "Ingreso manual";
    case "withdrawal":
      return "Retiro";
    case "refund":
      return "Reembolso";
    case "adjustment":
      return "Ajuste";
    case "void":
      return "Reverso";
    default:
      return movementType;
  }
}

function getMovementTitle(movement: CashDashboardData["activityMovements"][number]) {
  if (movement.movement_type === "sale" && movement.source_product_sale_id) {
    return movement.product_sale_number ? `Venta de productos ${movement.product_sale_number}` : "Venta de productos";
  }

  if (movement.movement_type === "sale") {
    return movement.customer_name ? `Cobro de ${movement.customer_name}` : "Cobro registrado";
  }

  if (movement.movement_type === "manual_income") {
    return "Ingreso manual";
  }

  if (movement.movement_type === "withdrawal") {
    return "Retiro de caja";
  }

  if (movement.movement_type === "refund") {
    return "Reembolso";
  }

  if (movement.movement_type === "adjustment") {
    return "Ajuste";
  }

  return "Movimiento";
}

function getMovementDescription(movement: CashDashboardData["activityMovements"][number]) {
  if (movement.movement_type === "sale" && movement.source_product_sale_id) {
    return movement.product_sale_items_summary || movement.note || "Venta registrada desde caja.";
  }

  return movement.note || movement.created_by_name || "Movimiento operativo.";
}

function RecentMovementsCard({
  movements,
  canReverseCash,
}: {
  movements: CashDashboardData["activityMovements"];
  canReverseCash: boolean;
}) {
  const recentMovements = movements.slice(0, 8);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Movimientos recientes</CardTitle>
          <CardDescription>Resumen compacto de la sesión actual y movimientos fuera de sesión.</CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/panel/caja/historial">Ver historial</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {recentMovements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay movimientos recientes para mostrar.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Movimiento</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Impacto</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentMovements.map((movement) => {
                const canReversePayment =
                  canReverseCash &&
                  movement.movement_type === "sale" &&
                  movement.source_payment_id &&
                  movement.source_payment_status === "posted";
                const canReverseProductSale =
                  canReverseCash &&
                  movement.movement_type === "sale" &&
                  movement.source_product_sale_id &&
                  movement.source_product_sale_status === "posted";

                return (
                  <TableRow key={movement.id} className={movement.session_link_status === "out_of_session" ? "bg-muted/20" : undefined}>
                    <TableCell className="align-top text-sm font-medium">{formatDateTime(movement.created_at)}</TableCell>
                    <TableCell className="min-w-[18rem] align-top">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={movement.movement_type === "void" ? "destructive" : "secondary"} className="h-6 px-2 text-[11px]">
                            {getMovementTypeLabel(movement.movement_type)}
                          </Badge>
                          {movement.session_link_status === "out_of_session" ? (
                            <Badge variant="outline" className="h-6 px-2 text-[11px]">
                              Fuera de sesión
                            </Badge>
                          ) : null}
                        </div>
                        <p className="font-medium">{getMovementTitle(movement)}</p>
                        <p className="text-xs text-muted-foreground">{getMovementDescription(movement)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top font-medium">{formatMoney(movement.amount)}</TableCell>
                    <TableCell className="align-top font-medium">{formatMoney(movement.cash_effect_amount)}</TableCell>
                    <TableCell className="align-top text-right">
                      {canReversePayment ? (
                        <ReversePaymentDialog
                          paymentId={movement.source_payment_id!}
                          sourceCategory={movement.category}
                          conceptLabel={movement.source_product_sale_id ? "Venta" : "Cobro"}
                          trigger={
                            <Button variant="outline" size="sm" className="gap-2">
                              <IconArrowsExchange className="h-4 w-4" />
                              Revertir
                            </Button>
                          }
                        />
                      ) : canReverseProductSale ? (
                        <ReverseProductSaleDialog
                          productSaleId={movement.source_product_sale_id!}
                          saleNumber={movement.product_sale_number}
                          totalAmount={movement.amount}
                          paymentMethod={movement.payment_method}
                          trigger={
                            <Button variant="outline" size="sm" className="gap-2">
                              <IconArrowsExchange className="h-4 w-4" />
                              Revertir
                            </Button>
                          }
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActionCard({
  title,
  description,
  tone = "default",
  children,
}: {
  title: string;
  description: string;
  tone?: "default" | "primary" | "danger";
  children: ReactNode;
}) {
  const toneClassName =
    tone === "primary"
      ? "border-primary/30 bg-primary/5"
      : tone === "danger"
        ? "border-destructive/30 bg-destructive/5"
        : "bg-background/40";

  return (
    <div className={`rounded-xl border p-4 ${toneClassName}`}>
      <div className="space-y-1">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function OpenSessionSupervisorCard({ sessions }: { sessions: CashDashboardData["supervisedOpenSessions"] }) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sesiones abiertas de otros usuarios</CardTitle>
        <CardDescription>
          Supervisión rápida de turnos activos. Desde aquí puedes revisar su detalle sin mezclarlo con tu caja actual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold">{session.opened_by_name || "Usuario"}</p>
              <p className="text-xs text-muted-foreground">
                {session.session_number} · abierta {formatDateTime(session.opened_at)}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/panel/caja/historial/${session.id}`}>Ver detalle</Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function CashDashboardClient({ data }: { data: CashDashboardData }) {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const canOperateCash = Boolean(currentUser?.isOwner || currentUser?.permissions?.includes("cash.operate"));
  const canConfigureRegister = Boolean(currentUser?.isOwner || currentUser?.role === "admin");
  const canReverseCash = canOperateCash;
  const canManageMembership = Boolean(
    currentUser?.isOwner || currentUser?.permissions?.includes("customers.manage_membership"),
  );
  const summaryCardsRef = useRef<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [openingAmount, setOpeningAmount] = useState("0.00");
  const [openingNotes, setOpeningNotes] = useState("");
  const [countedAmount, setCountedAmount] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [closePassword, setClosePassword] = useState("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const canCloseWithoutPassword = Boolean(
    currentUser?.isOwner ||
    currentUser?.role === "admin" ||
    currentUser?.permissions?.includes("cash.close_without_admin_password"),
  );
  const requiresClosePassword = Boolean(currentUser) && !canCloseWithoutPassword;

  const handleAction = (task: () => Promise<void>, successMessage: string) => {
    startTransition(async () => {
      try {
        await task();
        toast.success(successMessage);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo completar la acción");
      }
    });
  };

  const onOpenSession = () => {
    if (!data.register) {
      toast.error("No hay una caja disponible");
      return;
    }

    handleAction(async () => {
      await openCashSession(data.register!.id, Number(openingAmount || 0), openingNotes);
      setOpeningNotes("");
    }, "Caja abierta correctamente");
  };

  const onEnsureRegister = () => {
    handleAction(async () => {
      const result = await ensureDefaultCashRegister();
      if (!result.success) {
        throw new Error(result.error || "No se pudo configurar la caja principal");
      }
    }, "Caja principal configurada");
  };

  const expectedAmount = data.summary?.expectedAmount || 0;
  const countedDifference =
    countedAmount.trim().length > 0 && Number.isFinite(Number(countedAmount))
      ? Number(countedAmount) - expectedAmount
      : null;
  const requiresClosingNote = countedDifference !== null && Math.abs(countedDifference) > 0.009;

  useEffect(() => {
    const container = summaryCardsRef.current;
    if (!container || !data.currentSession) return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const cards = container.querySelectorAll<HTMLElement>("[data-summary-card]");
      if (cards.length === 0) return;

      gsap.fromTo(
        cards,
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.08,
          ease: "power3.out",
          overwrite: "auto",
        },
      );
    });

    return () => media.revert();
  }, [data.currentSession]);

  const onCloseSession = () => {
    if (!data.currentSession) return;
    if (requiresClosingNote && !closingNote.trim()) {
      toast.error("Debes registrar una observación cuando exista diferencia al cerrar la caja.");
      return;
    }

    if (requiresClosePassword && !closePassword.trim()) {
      toast.error("Debes ingresar la contraseña de un administrador u owner.");
      return;
    }

    handleAction(async () => {
      await closeCashSession(
        data.currentSession!.id,
        Number(countedAmount || 0),
        closingNote,
        requiresClosePassword ? closePassword : undefined,
      );
      setCloseDialogOpen(false);
      setCountedAmount("");
      setClosingNote("");
      setClosePassword("");
    }, "Caja cerrada correctamente");
  };

  if (!data.currentSession) {
    return (
      <div className="space-y-6">
        {!data.register ? (
          <Card>
            <CardHeader>
              <CardTitle>No hay cajas configuradas</CardTitle>
              <CardDescription>
                No existe una caja activa en <code>cash_registers</code>. Esto bloquea la apertura incluso para owner y admin.
              </CardDescription>
            </CardHeader>
            {canConfigureRegister ? (
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Puedes crear o reactivar la caja principal desde aquí para habilitar la apertura del turno.
                  </p>
                  <Button onClick={onEnsureRegister} disabled={isPending}>
                    <IconRefresh className="h-4 w-4" />
                    Crear caja principal
                  </Button>
                </div>
              </CardContent>
            ) : null}
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2">
              <IconLogin2 className="h-5 w-5" />
              Apertura de caja
            </CardTitle>
            <CardDescription>
              Registra el fondo inicial y habilita el centro operativo del turno para cobros, renovaciones y control de
              movimientos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 py-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Caja</p>
                  <p className="mt-2 text-lg font-semibold">{data.register?.name || "Sin caja activa"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Solo se mostrará la operación del turno cuando la caja esté abierta.
                  </p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Acceso operativo</p>
                  <p className="mt-2 text-lg font-semibold capitalize">{data.access.role}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    La apertura habilita cobros, renovaciones, ingresos manuales y cierre.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <IconAlertCircle className="mt-0.5 h-4 w-4" />
                  <p>
                    La pantalla operativa completa aparecerá después de abrir la caja. Ahí se mostrará la venta rápida
                    de productos y las acciones que requieren confirmación.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border bg-background/60 p-5">
              <div className="space-y-1">
                <p className="text-sm font-medium">Configurar apertura</p>
                <p className="text-sm text-muted-foreground">
                  Ingresa el fondo inicial y una observación opcional para el turno.
                </p>
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
                placeholder="0.00"
              />
              <Textarea
                rows={4}
                value={openingNotes}
                onChange={(event) => setOpeningNotes(event.target.value)}
                placeholder="Observación opcional de apertura"
              />
              {canOperateCash ? (
                <Button
                  className="w-full"
                  disabled={isPending || !data.canOpenSession || !data.register}
                  onClick={onOpenSession}
                >
                  <IconLogin2 className="h-4 w-4" />
                  Abrir caja
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <OpenSessionSupervisorCard sessions={data.supervisedOpenSessions} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
        <CardContent>
          <div ref={summaryCardsRef} className="space-y-4">
            <SummarySessionCard
              sessionNumber={data.currentSession.session_number}
              status={data.currentSession.status}
              registerName={data.currentSession.cash_register_name}
              openedAt={data.currentSession.opened_at}
              openedByName={data.currentSession.opened_by_name || "Usuario"}
            />
          </div>
        </CardContent>
      </Card>

      {data.outOfSessionMovements.length > 0 ? (
        <Alert className="border-amber-300 bg-amber-50/60 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
          <IconAlertCircle className="h-4 w-4" />
          <AlertTitle>Hay pagos fuera de sesión</AlertTitle>
          <AlertDescription>
            Se detectaron {data.outOfSessionMovements.length} movimientos registrados sin caja abierta. Revísalos en el
            historial de caja para seguimiento manual.
          </AlertDescription>
        </Alert>
      ) : null}

      <RecentMovementsCard movements={data.activityMovements} canReverseCash={canReverseCash} />

      {data.canOperateSession ? (
        <QuickProductSalePanel
          canSell={Boolean(currentUser?.isOwner || currentUser?.permissions?.includes("inventory.sell"))}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Acciones rápidas de caja</CardTitle>
          <CardDescription>Accesos operativos que requieren modal o confirmación.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {canOperateCash && (
            <QuickActionCard
              title="Registro de nuevo cliente"
              description="Registra una alta nueva, asigna plan y cobra dentro de la sesión actual."
              tone="primary"
            >
              <CustomerFormSheet
                entrypoint="cash"
                trigger={
                  <Button className="w-full">
                    <IconUserPlus className="h-4 w-4" />
                    Nuevo cliente + cobro
                  </Button>
                }
              />
            </QuickActionCard>
          )}

          {canManageMembership && (
            <QuickActionCard
              title="Renovar suscripción"
              description="Busca al cliente, revisa su contexto y continúa con la renovación rápida."
            >
              <CashCustomerPaymentDialog
                mode="renewal"
                trigger={
                  <Button className="w-full" variant="outline">
                    <IconRefresh className="h-4 w-4" />
                    Renovar suscripción
                  </Button>
                }
              />
            </QuickActionCard>
          )}

          {canOperateCash && (
            <QuickActionCard
              title="Cerrar caja"
              description="Confirma el contado real y registra la diferencia si existe."
              tone="danger"
            >
              <Button className="w-full" variant="destructive" onClick={() => setCloseDialogOpen(true)}>
                <IconDoorExit className="h-4 w-4" />
                Cerrar caja
              </Button>
            </QuickActionCard>
          )}
        </CardContent>
      </Card>

      <OpenSessionSupervisorCard sessions={data.supervisedOpenSessions} />

      <Dialog
        open={closeDialogOpen}
        onOpenChange={(nextOpen) => {
          setCloseDialogOpen(nextOpen);
          if (!nextOpen && !isPending) {
            setCountedAmount("");
            setClosingNote("");
            setClosePassword("");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cierre de caja</DialogTitle>
            <DialogDescription>
              Revisa el detalle del cierre y confirma la autorización correspondiente antes de finalizar la sesión.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sesión / caja</p>
                <p className="mt-2 text-sm font-semibold">{data.currentSession?.session_number || "-"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{data.register?.name || "Caja"}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Abrió</p>
                <p className="mt-2 text-sm font-semibold">{data.currentSession?.opened_by_name || "Usuario"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.currentSession?.opened_at ? formatDateTime(data.currentSession.opened_at) : "Sin fecha"}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Esperado</p>
                <p className="mt-2 text-xl font-semibold">{formatMoney(expectedAmount)}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Diferencia estimada</p>
                <p
                  className={`mt-2 text-xl font-semibold ${requiresClosingNote ? "text-destructive" : "text-emerald-600"}`}
                >
                  {countedDifference === null ? formatMoney(0) : formatMoney(countedDifference)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Efectivo contado</p>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={countedAmount}
                  onChange={(event) => setCountedAmount(event.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Autorización</p>
                <Input
                  value={
                    requiresClosePassword ? closePassword : currentUser?.full_name || currentUser?.email || "Tu usuario"
                  }
                  readOnly={!requiresClosePassword}
                  type={requiresClosePassword ? "password" : "text"}
                  onChange={(event) => setClosePassword(event.target.value)}
                  placeholder={requiresClosePassword ? "Contraseña de admin u owner" : "Cierre sin contraseña"}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Observación de cierre</p>
              <Textarea
                rows={4}
                value={closingNote}
                onChange={(event) => setClosingNote(event.target.value)}
                placeholder="Será obligatoria si existe diferencia."
              />
            </div>

            <Alert>
              <IconClock className="h-4 w-4" />
              <AlertTitle>
                {requiresClosePassword ? "Se registrará la autorización" : "No se requiere contraseña"}
              </AlertTitle>
              <AlertDescription>
                {requiresClosePassword
                  ? "La contraseña de un admin u owner se usará para registrar quién autorizó el cierre."
                  : "El cierre se registrará con tu usuario y quedará en la bitácora de caja."}
              </AlertDescription>
            </Alert>

            {requiresClosingNote ? (
              <Alert variant="destructive">
                <IconAlertCircle className="h-4 w-4" />
                <AlertTitle>Debes justificar la diferencia</AlertTitle>
                <AlertDescription>
                  El contado real difiere del efectivo esperado. Registra una observación antes de cerrar la caja.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <IconClock className="h-4 w-4" />
                <AlertTitle>Cierre listo para confirmar</AlertTitle>
                <AlertDescription>Si el contado es correcto, puedes cerrar la caja con este monto.</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setCloseDialogOpen(false);
                  setCountedAmount("");
                  setClosingNote("");
                }}
              >
                Cancelar
              </Button>
              <Button
                className="min-w-40"
                variant="destructive"
                disabled={isPending || !countedAmount || (requiresClosePassword && !closePassword.trim())}
                onClick={onCloseSession}
              >
                <IconDoorExit className="h-4 w-4" />
                Cerrar caja
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
