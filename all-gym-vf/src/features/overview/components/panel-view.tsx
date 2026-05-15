import PageContainer from "@/components/layout/page-container";
import { DashboardPeriodSelector } from "./period-selector";
import { Suspense } from "react";
import {
  KPICardsSkeleton,
  RevenueChartSkeleton,
  RecentPaymentsSkeleton,
  PlanDistributionSkeleton,
  GenericChartSkeleton,
} from "./dashboard-skeletons";
import {
  KPICardsWrapper,
  RevenueChartWrapper,
  RecentPaymentsWrapper,
  PlanDistributionWrapper,
  PaymentMethodWrapper,
  SubscriptionsFlowWrapper,
  ExpiringSubscriptionsWrapper,
  InactiveCustomersWrapper,
} from "./dashboard-wrappers";
import type { DashboardDateRange } from "../actions/panel-actions";

// ====================
// COMPONENT
// ====================

interface DashboardViewProps {
  period: string;
  dateRange: DashboardDateRange;
}

function getPeriodLabel(period?: string): string {
  switch (period) {
    case "week":
      return "esta semana";
    case "last_month":
      return "el mes pasado";
    case "year":
      return "este año";
    case "custom":
      return "el período seleccionado";
    case "month":
    default:
      return "este mes";
  }
}

export default function DashboardView({ period, dateRange }: DashboardViewProps) {
  const periodLabel = getPeriodLabel(period);

  return (
    <PageContainer>
      <div className="flex flex-1 flex-col space-y-6 p-1">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight">Estado del Negocio 📊</h1>
            <p className="text-muted-foreground">
              ¿Cómo va el gimnasio {periodLabel}? Aquí tienes todos los indicadores clave.
            </p>
          </div>

          <DashboardPeriodSelector />
        </div>

        {/* KPI Cards Row */}
        <Suspense fallback={<KPICardsSkeleton />}>
          <KPICardsWrapper dateRange={dateRange} />
        </Suspense>

        {/* Main Grid - Bento Style */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
          {/* Revenue Chart - Large */}
          <div className="lg:col-span-4">
            <Suspense fallback={<RevenueChartSkeleton />}>
              <RevenueChartWrapper />
            </Suspense>
          </div>

          {/* Recent Payments */}
          <div className="lg:col-span-3">
            <Suspense fallback={<RecentPaymentsSkeleton />}>
              <RecentPaymentsWrapper />
            </Suspense>
          </div>
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Plan Distribution */}
          <Suspense fallback={<PlanDistributionSkeleton />}>
            <PlanDistributionWrapper />
          </Suspense>

          {/* Payment Methods */}
          <Suspense fallback={<GenericChartSkeleton />}>
            <PaymentMethodWrapper dateRange={dateRange} />
          </Suspense>

          {/* Subscriptions Flow */}
          <div className="md:col-span-2">
            <Suspense fallback={<GenericChartSkeleton />}>
              <SubscriptionsFlowWrapper />
            </Suspense>
          </div>
        </div>

        {/* Alerts Row - Expiring & Inactive */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Expiring Subscriptions */}
          <Suspense fallback={<GenericChartSkeleton />}>
            <ExpiringSubscriptionsWrapper />
          </Suspense>

          {/* Inactive Customers */}
          <Suspense fallback={<GenericChartSkeleton />}>
            <InactiveCustomersWrapper />
          </Suspense>
        </div>
      </div>
    </PageContainer>
  );
}
