"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import { getSubscriptionAccessUntilDate } from "@/lib/subscriptions/grace-period";
import { es } from "date-fns/locale";
import {
  IconRotateClockwise,
  IconCalendarTime,
  IconTimeline,
  IconPremiumRights,
  IconDiscount2,
} from "@tabler/icons-react";
import type { SubscriptionEntry } from "../../../actions/customer-history-actions";
import { cn } from "@/lib/utils";
import { RenewSubscriptionSheet } from "../../renew-subscription-sheet";
import type { TrainingProfileRecord } from "@/lib/training/types";

interface SubscriptionHistoryTabProps {
  subscriptionHistory: SubscriptionEntry[];
  customerId: string;
  customerName: string;
  customerGender?: "male" | "female" | "other" | null;
  customerBirthDate?: string | null;
  lastAssessment?: {
    weight_kg: number;
    height_cm: number;
    body_type: string;
    diet_type?: string;
    activity_level?: string;
    body_fat_percentage?: number | null;
    muscle_mass?: number | null;
    chest_cm?: number | null;
    waist_cm?: number | null;
    hip_cm?: number | null;
    arm_right_cm?: number | null;
    arm_left_cm?: number | null;
    leg_right_cm?: number | null;
    leg_left_cm?: number | null;
    injuries?: string;
  } | null;
  trainingProfile?: TrainingProfileRecord | null;
}

export function SubscriptionHistoryTab({
  subscriptionHistory,
  customerId,
  customerName,
  customerGender,
  customerBirthDate,
  lastAssessment,
  trainingProfile,
}: SubscriptionHistoryTabProps) {
  const statusConfig: Record<string, { label: string; style: string }> = {
    active: { label: "Activa", style: "bg-green-500/10 text-green-600 border-green-500/20" },
    expired: { label: "Vencida", style: "bg-muted text-muted-foreground border-muted-foreground/20" },
    cancelled: { label: "Cancelada", style: "bg-red-500/10 text-red-600 border-red-500/20" },
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Card className="border-primary/10 shadow-sm overflow-hidden backdrop-blur-sm bg-card/80">
        <CardHeader className="bg-muted/30 border-b border-primary/5 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <IconTimeline className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Historial de Suscripciones</CardTitle>
                <CardDescription>Seguimiento de planes y membresías activadas</CardDescription>
              </div>
            </div>
            <RenewSubscriptionSheet
              customerId={customerId}
              customerName={customerName}
              customerGender={customerGender}
              customerBirthDate={customerBirthDate}
              lastAssessment={lastAssessment}
              trainingProfile={trainingProfile}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {subscriptionHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <IconRotateClockwise className="h-12 w-12 text-muted-foreground/20 mb-4 animate-spin-slow" />
              <p className="text-muted-foreground font-medium">No hay registros de suscripciones</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-y border-primary/5 whitespace-nowrap">
                  <TableHead className="font-bold text-xs uppercase tracking-wider pl-6">Plan / Servicio</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Período de Vigencia</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-center">Duración</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Inversión</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider pr-6 text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptionHistory.map((sub) => {
                  const parseDate = (dateStr: string | Date) => {
                    if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
                      const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
                      return new Date(year, month - 1, day);
                    }
                    return new Date(dateStr);
                  };

                  const startDate = parseDate(sub.start_date);
                  const endDate = parseDate(sub.end_date);
                  const duration = differenceInDays(endDate, startDate);
                  const total = sub.price - sub.discount_amount;

                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const accessUntil = getSubscriptionAccessUntilDate(sub.end_date, sub.grace_days);
                  const accessUntilNormalized = accessUntil ? new Date(accessUntil) : new Date(endDate);
                  accessUntilNormalized.setHours(0, 0, 0, 0);

                  let realStatus = sub.status;
                  if (sub.status === "active" && accessUntilNormalized < today) {
                    realStatus = "expired";
                  }

                  const config = statusConfig[realStatus] || { label: realStatus, style: "bg-muted" };

                  return (
                    <TableRow key={sub.id} className="hover:bg-primary/[0.02] border-primary/5 transition-colors h-16">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-full bg-primary/5 text-primary">
                            <IconPremiumRights className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm tracking-tight">{sub.plan_name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              Adquirido en: {format(startDate, "PP", { locale: es })}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <IconCalendarTime className="h-3.5 w-3.5 text-muted-foreground" />
                          <div className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                            <span>{format(startDate, "dd/MM/yyyy", { locale: es })}</span>
                            <span className="text-muted-foreground px-1">→</span>
                            <span>{format(endDate, "dd/MM/yyyy", { locale: es })}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className="bg-muted/50 text-muted-foreground border-transparent px-2 py-0.5 text-[10px] font-bold"
                        >
                          {duration} DÍAS
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-black text-emerald-600">Q{total.toFixed(2)}</span>
                          {sub.discount_amount > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-orange-500 font-bold">
                              <IconDiscount2 className="h-2.5 w-2.5" />
                              <span>Econ. Q{sub.discount_amount.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-3 py-1 rounded-full font-black uppercase tracking-tighter text-[10px] border-none ml-auto w-fit block",
                            config.style,
                          )}
                        >
                          {config.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
