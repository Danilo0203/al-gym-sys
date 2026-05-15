import {
  getDashboardKPIs,
  getRevenueByMonth,
  getPlanDistribution,
  getSubscriptionsFlow,
  getPaymentMethodDistribution,
  getRecentPayments,
  getExpiringSubscriptions,
  getInactiveCustomers,
  DashboardDateRange,
} from "../actions/panel-actions";
import { KPICards } from "./kpi-cards";
import { RevenueChart } from "./revenue-chart";
import { PlanDistributionChart } from "./plan-distribution-chart";
import { SubscriptionsFlowChart } from "./subscriptions-flow-chart";
import { PaymentMethodChart } from "./payment-method-chart";
import { RecentPaymentsTable } from "./recent-payments-table";
import { ExpiringSubscriptionsTable } from "./expiring-subscriptions-table";
import { InactiveCustomersTable } from "./inactive-customers-table";

export async function KPICardsWrapper({ dateRange }: { dateRange: DashboardDateRange }) {
  const data = await getDashboardKPIs(dateRange);
  return <KPICards data={data} />;
}

export async function RevenueChartWrapper() {
  const data = await getRevenueByMonth();
  return <RevenueChart data={data} />;
}

export async function PlanDistributionWrapper() {
  const data = await getPlanDistribution();
  return <PlanDistributionChart data={data} />;
}

export async function SubscriptionsFlowWrapper() {
  const data = await getSubscriptionsFlow();
  return <SubscriptionsFlowChart data={data} />;
}

export async function PaymentMethodWrapper({ dateRange }: { dateRange: DashboardDateRange }) {
  const data = await getPaymentMethodDistribution(dateRange);
  return <PaymentMethodChart data={data} />;
}

export async function RecentPaymentsWrapper() {
  const data = await getRecentPayments();
  return <RecentPaymentsTable data={data} />;
}

export async function ExpiringSubscriptionsWrapper() {
  const data = await getExpiringSubscriptions();
  return <ExpiringSubscriptionsTable data={data} />;
}

export async function InactiveCustomersWrapper() {
  const data = await getInactiveCustomers();
  return <InactiveCustomersTable data={data} />;
}
