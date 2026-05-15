"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  IconReceipt2,
  IconChartLine,
  IconCreditCard,
  IconCash,
  IconArrowsExchange,
  IconTag,
} from "@tabler/icons-react";
import type { PaymentEntry } from "../../../actions/customer-history-actions";
import { cn } from "@/lib/utils";

interface PaymentHistoryTabProps {
  paymentHistory: PaymentEntry[];
}

export function PaymentHistoryTab({ paymentHistory }: PaymentHistoryTabProps) {
  const totalPaid = paymentHistory.reduce((sum, p) => sum + p.amount_paid, 0);
  const totalDiscount = paymentHistory.reduce((sum, p) => sum + p.discount_applied, 0);

  // Fix: Parse YYYY-MM-DD manually
  const parseDate = (dateStr: string | Date | undefined | null) => {
    if (!dateStr) return null;
    if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  };

  const paymentMethodIcons: Record<string, React.ReactNode> = {
    cash: <IconCash className="h-4 w-4" />,
    card: <IconCreditCard className="h-4 w-4" />,
    transfer: <IconArrowsExchange className="h-4 w-4" />,
  };

  const paymentMethodLabels: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
  };

  const statusLabels: Record<string, string> = {
    active: "Activa",
    expired: "Vencida",
    cancelled: "Cancelada",
  };

  const statusStyles: Record<string, string> = {
    active: "bg-green-500/10 text-green-600 border-green-500/20",
    expired: "bg-muted text-muted-foreground border-muted-foreground/20 text-[10px]",
    cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Resumen */}
      {/* Resumen */}
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-primary/20 bg-gradient-to-br from-background via-muted/50 to-primary/5 overflow-hidden relative group hover:shadow-lg transition-all duration-300">
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 group-hover:scale-110 transition-all duration-500">
            <IconReceipt2 size={64} className="text-primary blur-[1px]" />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Cantidad de Pagos
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <p className="text-4xl font-black text-foreground">{paymentHistory.length}</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-gradient-to-br from-background via-emerald-500/5 to-emerald-500/10 overflow-hidden relative group hover:shadow-lg transition-all duration-300">
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 group-hover:scale-110 transition-all duration-500">
            <IconChartLine size={64} className="text-emerald-500 blur-[1px]" />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-emerald-600/80 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Total Invertido
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <p className="text-4xl font-black text-emerald-600">
              Q{totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-gradient-to-br from-background via-orange-500/5 to-orange-500/10 overflow-hidden relative group hover:shadow-lg transition-all duration-300">
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 group-hover:scale-110 transition-all duration-500">
            <IconTag size={64} className="text-orange-500 blur-[1px]" />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-orange-600/80 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              Ahorro en Descuentos
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <p className="text-4xl font-black text-orange-500">
              Q{totalDiscount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de pagos */}
      <Card className="border-primary/10 shadow-sm overflow-hidden backdrop-blur-sm bg-card/80">
        <CardHeader className="bg-muted/30 border-b border-primary/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconReceipt2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Historial de Transacciones</CardTitle>
              <CardDescription>Detalle exhaustivo de pagos y membresías</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {paymentHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No hay registros de pagos</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-y border-primary/5 whitespace-nowrap">
                  <TableHead className="font-bold text-xs uppercase tracking-wider pl-6">Fecha</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Membresía</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-right">
                    Monto Original
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Descuento</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Monto Pagado</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-center">
                    Forma de Pago
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Vigencia</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider pr-6 text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentHistory.map((payment) => (
                  <TableRow
                    key={payment.id}
                    className="hover:bg-primary/[0.02] border-primary/5 transition-colors h-16"
                  >
                    <TableCell className="pl-6">
                      <span className="text-sm font-medium">
                        {format(new Date(payment.payment_date), "dd/MM/yy", { locale: es })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{payment.plan_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground font-medium">
                      Q{payment.amount_original.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {payment.discount_applied > 0 ? (
                        <Badge
                          variant="outline"
                          className="bg-orange-500/10 text-orange-600 border-none font-bold text-[10px]"
                        >
                          -Q{payment.discount_applied.toFixed(2)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs pr-2">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-black text-emerald-600">Q{payment.amount_paid.toFixed(2)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Badge
                          variant="outline"
                          className="px-2 font-medium capitalize flex items-center gap-1.5 border-primary/10"
                        >
                          {paymentMethodIcons[payment.payment_method] || <IconReceipt2 className="h-3.5 w-3.5" />}
                          {paymentMethodLabels[payment.payment_method] || payment.payment_method}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {payment.subscription_start && payment.subscription_end ? (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="text-muted-foreground">del</span>
                          <span className="font-bold">
                            {(() => {
                              const start = parseDate(payment.subscription_start);
                              return start ? format(start, "dd/MM/yy") : "N/A";
                            })()}
                          </span>
                          <span className="text-muted-foreground">al</span>
                          <span className="font-bold">
                            {(() => {
                              const end = parseDate(payment.subscription_end);
                              return end ? format(end, "dd/MM/yy") : "N/A";
                            })()}
                          </span>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-2.5 py-0.5 rounded-full font-bold uppercase tracking-tighter text-[10px] border-none ml-auto w-fit block",
                          statusStyles[payment.subscription_status] || "bg-muted",
                        )}
                      >
                        {statusLabels[payment.subscription_status] || payment.subscription_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
