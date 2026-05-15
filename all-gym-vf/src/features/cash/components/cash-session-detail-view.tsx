import Link from "next/link";
import { IconArrowsExchange } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CashMovementView, CashSessionDetailData, PaymentMethod } from "@/features/cash/actions/cash-actions";
import { ReversePaymentDialog } from "@/features/cash/components/reverse-payment-dialog";
import { ReverseProductSaleDialog } from "@/features/cash/components/reverse-product-sale-dialog";

type MovementStoryRole = "original" | "void" | "corrected";

interface MovementStoryMeta {
  groupId: string;
  role: MovementStoryRole;
  originalMovementId: string | null;
  originalPaymentId: string | null;
  originalCreatedAt: string | null;
}

interface MovementDisplayGroup {
  key: string;
  topTimestamp: number;
  storyLabel: string | null;
  items: Array<{
    movement: CashMovementView;
    meta: MovementStoryMeta | null;
  }>;
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

function formatTime(value: string | null | undefined) {
  if (!value) return "sin hora";
  return new Intl.DateTimeFormat("es-GT", {
    timeStyle: "short",
    timeZone: "America/Guatemala",
  }).format(new Date(value));
}

function getTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function shortId(value: string | null | undefined) {
  if (!value) return "Sin referencia";
  return value.length <= 10 ? value : `${value.slice(0, 8)}...`;
}

function extractReferencedPaymentId(note: string | null | undefined) {
  if (!note) return null;
  const match = note.match(/pago ([0-9a-f-]{8,})/i);
  return match?.[1] ?? null;
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

function getStatusLabel(status: string) {
  switch (status) {
    case "open":
      return "Abierta";
    case "closed":
      return "Cerrada";
    case "closed_with_difference":
      return "Con diferencia";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
}

function getStatusVariant(status: string) {
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

function getStateBadge(movement: CashMovementView, meta: MovementStoryMeta | null) {
  if (meta?.role === "void" || movement.movement_type === "void") {
    return { label: "Anulación", variant: "destructive" as const };
  }

  if (movement.movement_type === "sale" && movement.source_payment_status === "reversed") {
    return { label: "Revertido", variant: "warning" as const };
  }

  if (movement.movement_type === "sale" && movement.source_product_sale_status === "voided") {
    return { label: "Anulada", variant: "warning" as const };
  }

  if (meta?.role === "corrected") {
    return { label: "Activo", variant: "success" as const };
  }

  if (movement.movement_type === "sale") {
    return { label: "Activo", variant: "success" as const };
  }

  return { label: "Registrado", variant: "secondary" as const };
}

function getMovementTypeBadge(movement: CashMovementView, meta: MovementStoryMeta | null) {
  if (meta?.role === "corrected") {
    return { label: "Cobro corregido", variant: "success" as const };
  }

  switch (movement.movement_type) {
    case "sale":
      return { label: "Cobro", variant: "secondary" as const };
    case "void":
      return { label: "Reverso", variant: "destructive" as const };
    case "manual_income":
      return { label: "Ingreso manual", variant: "default" as const };
    case "withdrawal":
      return { label: "Retiro", variant: "warning" as const };
    case "refund":
      return { label: "Reembolso", variant: "warning" as const };
    case "adjustment":
      return { label: "Ajuste", variant: "outline" as const };
    default:
      return { label: String(movement.movement_type).replaceAll("_", " "), variant: "outline" as const };
  }
}

function getMovementNarrative(movement: CashMovementView, meta: MovementStoryMeta | null) {
  const originalTime = meta?.originalCreatedAt ? formatTime(meta.originalCreatedAt) : null;
  const referencedPaymentId = extractReferencedPaymentId(movement.note);

  if (meta?.role === "original") {
    return {
      title: "Cobro original",
      description: "Este cobro fue revertido y luego sustituido por una corrección.",
      reference: movement.source_payment_id ? `Pago ${shortId(movement.source_payment_id)}` : null,
    };
  }

  if (meta?.role === "void" || movement.movement_type === "void") {
    return {
      title: "Reverso administrativo",
      description: originalTime
        ? `Anula el cobro registrado a las ${originalTime}.`
        : "Anula un cobro anterior de la sesión.",
      reference: referencedPaymentId ? `Revierte ${shortId(referencedPaymentId)}` : "Anulación de cobro",
    };
  }

  if (meta?.role === "corrected") {
    return {
      title: "Nuevo cobro corregido",
      description: originalTime
        ? `Sustituye el cobro original de las ${originalTime}.`
        : "Nuevo cobro creado después del reverso.",
      reference: movement.source_payment_id ? `Pago ${shortId(movement.source_payment_id)}` : null,
    };
  }

  switch (movement.movement_type) {
    case "sale":
      if (movement.category === "product") {
        if (movement.source_product_sale_status === "voided") {
          return {
            title: movement.product_sale_number ? `Venta anulada ${movement.product_sale_number}` : "Venta anulada",
            description: movement.product_sale_items_summary || movement.note || "Esta venta fue anulada y el inventario fue restaurado.",
            reference: movement.source_product_sale_id ? `Venta ${shortId(movement.source_product_sale_id)}` : null,
          };
        }

        return {
          title: movement.product_sale_number ? `Venta de productos ${movement.product_sale_number}` : "Venta de productos",
          description: movement.product_sale_items_summary || movement.note || "Venta registrada desde caja.",
          reference: movement.source_product_sale_id ? `Venta ${shortId(movement.source_product_sale_id)}` : null,
        };
      }

      return {
        title: "Cobro registrado",
        description: "Cobro válido registrado dentro de la sesión.",
        reference: movement.source_payment_id ? `Pago ${shortId(movement.source_payment_id)}` : null,
      };
    case "manual_income":
      return {
        title: "Ingreso manual",
        description: movement.note || "Ingreso operativo registrado manualmente.",
        reference: movement.note ? null : "Movimiento manual",
      };
    case "withdrawal":
      return {
        title: "Retiro",
        description: movement.note || "Salida de caja registrada manualmente.",
        reference: movement.note ? null : "Movimiento manual",
      };
    case "refund":
      return {
        title: "Reembolso",
        description: movement.note || "Devolución registrada en caja.",
        reference: movement.source_payment_id ? `Pago ${shortId(movement.source_payment_id)}` : null,
      };
    case "adjustment":
      return {
        title: "Ajuste",
        description: movement.note || "Ajuste operativo aplicado a la sesión.",
        reference: null,
      };
    default:
      return {
        title: "Movimiento de caja",
        description: movement.note || "Registro operativo de la sesión.",
        reference: null,
      };
  }
}

function buildMovementStoryMetaMap(movements: CashMovementView[]) {
  const storyMetaMap = new Map<string, MovementStoryMeta>();
  const salesByPaymentId = new Map<string, CashMovementView>();
  const assignedCorrectedSaleIds = new Set<string>();
  const ascendingMovements = [...movements].sort((a, b) => getTimestamp(a.created_at) - getTimestamp(b.created_at));

  for (const movement of ascendingMovements) {
    if (movement.movement_type === "sale" && movement.source_payment_id) {
      salesByPaymentId.set(movement.source_payment_id, movement);
    }
  }

  for (const movement of ascendingMovements) {
    if (movement.movement_type !== "void") continue;

    const originalPaymentId = extractReferencedPaymentId(movement.note);
    const originalSale = originalPaymentId ? salesByPaymentId.get(originalPaymentId) || null : null;
    const correctionWindowStart = getTimestamp(movement.created_at);
    const correctionWindowEnd = correctionWindowStart + 5 * 60 * 1000;

    const correctedSale =
      ascendingMovements.find((candidate) => {
        if (candidate.movement_type !== "sale") return false;
        if (assignedCorrectedSaleIds.has(candidate.id)) return false;
        if (candidate.id === originalSale?.id) return false;
        if (candidate.source_payment_status && candidate.source_payment_status !== "posted") return false;
        if (getTimestamp(candidate.created_at) < correctionWindowStart) return false;
        if (getTimestamp(candidate.created_at) > correctionWindowEnd) return false;
        if (candidate.customer_id !== movement.customer_id) return false;
        if (candidate.source_subscription_id !== movement.source_subscription_id) return false;
        if (candidate.created_by_user_id !== movement.created_by_user_id) return false;
        return true;
      }) || null;

    const groupId = originalSale?.id || movement.id;

    if (originalSale) {
      storyMetaMap.set(originalSale.id, {
        groupId,
        role: "original",
        originalMovementId: originalSale.id,
        originalPaymentId,
        originalCreatedAt: originalSale.created_at,
      });
    }

    storyMetaMap.set(movement.id, {
      groupId,
      role: "void",
      originalMovementId: originalSale?.id || null,
      originalPaymentId,
      originalCreatedAt: originalSale?.created_at || null,
    });

    if (correctedSale) {
      assignedCorrectedSaleIds.add(correctedSale.id);
      storyMetaMap.set(correctedSale.id, {
        groupId,
        role: "corrected",
        originalMovementId: originalSale?.id || null,
        originalPaymentId,
        originalCreatedAt: originalSale?.created_at || null,
      });
    }
  }

  return storyMetaMap;
}

function buildMovementDisplayGroups(movements: CashMovementView[]) {
  const storyMetaMap = buildMovementStoryMetaMap(movements);
  const groupMap = new Map<string, MovementDisplayGroup>();

  for (const movement of movements) {
    const meta = storyMetaMap.get(movement.id) || null;
    const groupKey = meta?.groupId || `single:${movement.id}`;
    const existingGroup = groupMap.get(groupKey);

    const item = { movement, meta };
    const itemTimestamp = getTimestamp(movement.created_at);

    if (existingGroup) {
      existingGroup.items.push(item);
      existingGroup.topTimestamp = Math.max(existingGroup.topTimestamp, itemTimestamp);
      continue;
    }

    groupMap.set(groupKey, {
      key: groupKey,
      topTimestamp: itemTimestamp,
      storyLabel: meta ? "Corrección de cobro" : null,
      items: [item],
    });
  }

  return Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => {
        const roleOrder = {
          original: 0,
          void: 1,
          corrected: 2,
        } satisfies Record<MovementStoryRole, number>;

        if (a.meta?.role && b.meta?.role) {
          return roleOrder[a.meta.role] - roleOrder[b.meta.role];
        }

        return getTimestamp(b.movement.created_at) - getTimestamp(a.movement.created_at);
      }),
    }))
    .sort((a, b) => b.topTimestamp - a.topTimestamp);
}

function getImpactTone(cashEffectAmount: number) {
  if (cashEffectAmount > 0) return "text-emerald-600 dark:text-emerald-400";
  if (cashEffectAmount < 0) return "text-destructive";
  return "text-muted-foreground";
}

function getRowTone(meta: MovementStoryMeta | null, movement: CashMovementView) {
  if (meta?.role === "corrected") return "bg-emerald-500/5";
  if (meta?.role === "void" || movement.movement_type === "void") return "bg-destructive/5";
  if (movement.movement_type === "sale" && movement.source_payment_status === "reversed") return "bg-amber-500/5";
  if (movement.movement_type === "sale" && movement.source_product_sale_status === "voided") return "bg-amber-500/5";
  return "";
}

export function CashSessionDetailView({
  data,
  canReverseMovements,
}: {
  data: CashSessionDetailData;
  canReverseMovements: boolean;
}) {
  const { session, summary, movements } = data;
  const movementGroups = buildMovementDisplayGroups(movements);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{session.session_number}</h2>
          <p className="text-sm text-muted-foreground">
            {session.cash_register_name} · Abrió {session.opened_by_name} · Cerró {session.closed_by_name || "Pendiente"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={getStatusVariant(session.status)}>{getStatusLabel(session.status)}</Badge>
          <Button variant="outline" asChild>
            <Link href="/panel/caja/historial">Volver al historial</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Apertura</CardTitle>
            <CardDescription>{formatDateTime(session.opened_at)}</CardDescription>
          </CardHeader>
          <CardContent>{formatMoney(session.opening_amount)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Esperado</CardTitle>
            <CardDescription>Snapshot al cierre</CardDescription>
          </CardHeader>
          <CardContent>{formatMoney(summary.expectedAmount)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contado</CardTitle>
            <CardDescription>{session.closed_at ? formatDateTime(session.closed_at) : "Pendiente"}</CardDescription>
          </CardHeader>
          <CardContent>{formatMoney(summary.countedAmount)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diferencia</CardTitle>
            <CardDescription>
              {session.closed_at ? formatDateTime(session.closed_at) : "Pendiente"}
            </CardDescription>
          </CardHeader>
          <CardContent>{formatMoney(summary.differenceAmount)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Autorizó cierre</CardTitle>
            <CardDescription>{session.closed_at ? "Bitácora de cierre" : "Pendiente"}</CardDescription>
          </CardHeader>
          <CardContent>{session.closed_by_name || "Pendiente"}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas efectivo</CardTitle>
          </CardHeader>
          <CardContent>{formatMoney(summary.totalsByMethod.cash)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas tarjeta</CardTitle>
          </CardHeader>
          <CardContent>{formatMoney(summary.totalsByMethod.card)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transferencias</CardTitle>
          </CardHeader>
          <CardContent>{formatMoney(summary.totalsByMethod.transfer)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reversos</CardTitle>
          </CardHeader>
          <CardContent>{formatMoney(summary.voids)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
          <CardDescription>{session.notes || "Sin observaciones de cierre."}</CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay movimientos registrados en esta sesión.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Movimiento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Impacto en caja</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementGroups.flatMap((group) => {
                  const rows = group.items.map(({ movement, meta }) => {
                    const movementBadge = getMovementTypeBadge(movement, meta);
                    const stateBadge = getStateBadge(movement, meta);
                    const narrative = getMovementNarrative(movement, meta);
                    const reverseAction =
                      canReverseMovements && movement.movement_type === "sale" ? (
                        movement.source_payment_id && movement.source_payment_status === "posted" ? (
                          <ReversePaymentDialog
                            paymentId={movement.source_payment_id!}
                            sourceCategory={movement.category}
                            conceptLabel={movement.category === "product" ? "Venta" : "Cobro"}
                            trigger={
                              <Button variant="outline" size="sm" className="gap-2">
                                <IconArrowsExchange className="h-4 w-4" />
                                Revertir
                              </Button>
                            }
                          />
                        ) : movement.source_product_sale_id && movement.source_product_sale_status === "posted" ? (
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
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      );

                    return (
                      <TableRow
                        key={movement.id}
                        className={cn("align-top", getRowTone(meta, movement))}
                      >
                        <TableCell className="font-medium">{formatDateTime(movement.created_at)}</TableCell>
                        <TableCell className="min-w-[24rem] whitespace-normal">
                          <div className={cn("space-y-1", meta?.role && meta.role !== "original" ? "pl-4" : "")}>
                            <div className="flex flex-wrap items-center gap-2">
                              {meta?.role && meta.role !== "original" ? (
                                <span className="text-sm text-muted-foreground">↳</span>
                              ) : null}
                              <Badge variant={movementBadge.variant}>{movementBadge.label}</Badge>
                              {narrative.reference ? (
                                <span
                                  className="text-xs text-muted-foreground"
                                  title={
                                    movement.source_payment_id ||
                                    movement.source_product_sale_id ||
                                    extractReferencedPaymentId(movement.note) ||
                                    ""
                                  }
                                >
                                  {narrative.reference}
                                </span>
                              ) : null}
                            </div>
                            <div>
                              <p className="font-medium">{narrative.title}</p>
                              <p className="text-sm text-muted-foreground">{narrative.description}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{movement.customer_name || "N/A"}</TableCell>
                        <TableCell>{getPaymentMethodLabel(movement.payment_method)}</TableCell>
                        <TableCell className="font-medium">{formatMoney(movement.amount)}</TableCell>
                        <TableCell className={cn("font-medium", getImpactTone(movement.cash_effect_amount))}>
                          {formatMoney(movement.cash_effect_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={stateBadge.variant}>{stateBadge.label}</Badge>
                        </TableCell>
                        <TableCell>{movement.created_by_name}</TableCell>
                        <TableCell className="text-right">{reverseAction}</TableCell>
                      </TableRow>
                    );
                  });

                  if (!group.storyLabel) {
                    return rows;
                  }

                  return [
                    <TableRow key={`${group.key}:story`} className="hover:bg-transparent">
                      <TableCell colSpan={9} className="bg-muted/20 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{group.storyLabel}</Badge>
                          <span>Se muestra el cobro original, su reverso y el registro corregido.</span>
                        </div>
                      </TableCell>
                    </TableRow>,
                    ...rows,
                  ];
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
