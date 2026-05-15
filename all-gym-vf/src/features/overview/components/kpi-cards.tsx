"use client";

import { Card, CardDescription, CardFooter, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconCash,
  IconUsers,
  IconUserOff,
  IconReceipt,
  IconCreditCard,
  IconPercentage,
} from "@tabler/icons-react";
import type { DashboardKPIs } from "../actions/panel-actions";

interface KPICardsProps {
  data: DashboardKPIs;
}

export function KPICards({ data }: KPICardsProps) {
  const formatCurrency = (amount: number) => {
    return `Q${amount.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* Ingresos Totales */}
      <Card className="@container/card bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/5 border-emerald-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500/20 p-2">
              <IconCash className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardDescription className="text-sm font-medium">Ingresos del Mes</CardDescription>
          </div>
          <CardTitle className="text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {formatCurrency(data.totalRevenue)}
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className={
                data.revenueChange >= 0
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300"
              }
            >
              {data.revenueChange >= 0 ? (
                <IconTrendingUp className="mr-1 h-3 w-3" />
              ) : (
                <IconTrendingDown className="mr-1 h-3 w-3" />
              )}
              {data.revenueChange >= 0 ? "+" : ""}
              {data.revenueChange}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="text-muted-foreground">vs. mes anterior</div>
        </CardFooter>
      </Card>

      {/* Miembros Activos */}
      <Card className="@container/card bg-gradient-to-br from-blue-500/10 to-blue-500/5 dark:from-blue-500/20 dark:to-blue-500/5 border-blue-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-500/20 p-2">
              <IconUsers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <CardDescription className="text-sm font-medium">Miembros Activos</CardDescription>
          </div>
          <CardTitle className="text-3xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
            {data.activeMembers}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300">
              <IconUserOff className="mr-1 h-3 w-3" />
              {data.inactiveMembers} inactivos
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="text-muted-foreground">Suscripciones vigentes</div>
        </CardFooter>
      </Card>

      {/* Tasa de Abandono */}
      <Card className="@container/card bg-gradient-to-br from-orange-500/10 to-orange-500/5 dark:from-orange-500/20 dark:to-orange-500/5 border-orange-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-orange-500/20 p-2">
              <IconPercentage className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <CardDescription className="text-sm font-medium">Tasa de Abandono</CardDescription>
          </div>
          <CardTitle className="text-3xl font-bold tabular-nums text-orange-700 dark:text-orange-300">
            {data.churnRate}%
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className={
                data.churnRate <= 5
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
                  : data.churnRate <= 10
                  ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-700"
                  : "border-red-500/50 bg-red-500/10 text-red-700"
              }
            >
              {data.churnRate <= 5 ? "Excelente" : data.churnRate <= 10 ? "Normal" : "Alto"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="text-muted-foreground">Churn rate este mes</div>
        </CardFooter>
      </Card>

      {/* Ticket Promedio */}
      <Card className="@container/card bg-gradient-to-br from-purple-500/10 to-purple-500/5 dark:from-purple-500/20 dark:to-purple-500/5 border-purple-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-purple-500/20 p-2">
              <IconReceipt className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <CardDescription className="text-sm font-medium">Ticket Promedio</CardDescription>
          </div>
          <CardTitle className="text-3xl font-bold tabular-nums text-purple-700 dark:text-purple-300">
            {formatCurrency(data.avgTicket)}
          </CardTitle>
          <CardAction>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <IconCash className="h-3 w-3 text-emerald-500" />
                {formatCurrency(data.cashAmount)}
              </div>
              <div className="flex items-center gap-1">
                <IconCreditCard className="h-3 w-3 text-blue-500" />
                {formatCurrency(data.cardAmount)}
              </div>
            </div>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="text-muted-foreground">Por transacción</div>
        </CardFooter>
      </Card>
    </div>
  );
}
