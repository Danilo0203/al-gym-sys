import PageContainer from '@/components/layout/page-container';
import { Suspense } from 'react';
import { KPICards } from './kpi-cards';
import { RevenueChart } from './revenue-chart';
import { PlanDistributionChart } from './plan-distribution-chart';
import { SubscriptionsFlowChart } from './subscriptions-flow-chart';
import { PaymentMethodChart } from './payment-method-chart';
import { RecentPaymentsTable } from './recent-payments-table';
import { ExpiringSubscriptionsTable } from './expiring-subscriptions-table';
import { InactiveCustomersTable } from './inactive-customers-table';
import { DashboardClientContainer } from './panel-client-container';
import {
  getDashboardKPIs,
  getRevenueByMonth,
  getPlanDistribution,
  getSubscriptionsFlow,
  getPaymentMethodDistribution,
  getRecentPayments,
  getExpiringSubscriptions,
  getInactiveCustomers,
  type DashboardDateRange
} from '../actions/panel-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, startOfYear, endOfYear, format } from 'date-fns';

interface DashboardProps {
  searchParams: {
    period?: string;
    from?: string;
    to?: string;
  };
}

// Helper para obtener el rango de fechas basado en el período
function getDateRangeFromPeriod(period?: string, from?: string, to?: string): DashboardDateRange {
  const now = new Date();
  
  if (period === 'custom' && from && to) {
    return { from, to };
  }
  
  switch (period) {
    case 'week':
      return {
        from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'last_month':
      return {
        from: format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
        to: format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
      };
    case 'year':
      return {
        from: format(startOfYear(now), 'yyyy-MM-dd'),
        to: format(endOfYear(now), 'yyyy-MM-dd'),
      };
    case 'month':
    default:
      return {
        from: format(startOfMonth(now), 'yyyy-MM-dd'),
        to: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
  }
}

// Helper para obtener el label del período
function getPeriodLabel(period?: string): string {
  switch (period) {
    case 'week':
      return 'esta semana';
    case 'last_month':
      return 'el mes pasado';
    case 'year':
      return 'este año';
    case 'custom':
      return 'el período seleccionado';
    case 'month':
    default:
      return 'este mes';
  }
}

// Skeleton Components
function KPICardsSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className='@container/card'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <Skeleton className='h-9 w-9 rounded-lg' />
              <Skeleton className='h-4 w-24' />
            </div>
            <Skeleton className='h-8 w-32 mt-2' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-3 w-20' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className='h-5 w-40' />
        <Skeleton className='h-3 w-60' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-[200px] w-full' />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-5 w-40' />
        <Skeleton className='h-3 w-60' />
      </CardHeader>
      <CardContent className='space-y-3'>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className='flex items-center gap-3'>
            <Skeleton className='h-9 w-9 rounded-full' />
            <div className='flex-1'>
              <Skeleton className='h-4 w-32 mb-1' />
              <Skeleton className='h-3 w-20' />
            </div>
            <Skeleton className='h-6 w-16' />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Data Fetching Components with date range support
async function KPICardsData({ dateRange }: { dateRange: DashboardDateRange }) {
  const data = await getDashboardKPIs(dateRange);
  return <KPICards data={data} />;
}

async function RevenueChartData() {
  const data = await getRevenueByMonth();
  return <RevenueChart data={data} />;
}

async function PlanDistributionChartData() {
  const data = await getPlanDistribution();
  return <PlanDistributionChart data={data} />;
}

async function SubscriptionsFlowChartData() {
  const data = await getSubscriptionsFlow();
  return <SubscriptionsFlowChart data={data} />;
}

async function PaymentMethodChartData({ dateRange }: { dateRange: DashboardDateRange }) {
  const data = await getPaymentMethodDistribution(dateRange);
  return <PaymentMethodChart data={data} />;
}

async function RecentPaymentsTableData() {
  const data = await getRecentPayments(8);
  return <RecentPaymentsTable data={data} />;
}

async function ExpiringSubscriptionsTableData() {
  const data = await getExpiringSubscriptions(7);
  return <ExpiringSubscriptionsTable data={data} />;
}

async function InactiveCustomersTableData() {
  const data = await getInactiveCustomers(10);
  return <InactiveCustomersTable data={data} />;
}

// Server content that will be wrapped by the client container
function DashboardServerContent({ dateRange }: { dateRange: DashboardDateRange }) {
  return (
    <>
      {/* KPI Cards Row */}
      <Suspense fallback={<KPICardsSkeleton />} key={`kpi-${dateRange.from}-${dateRange.to}`}>
        <KPICardsData dateRange={dateRange} />
      </Suspense>

      {/* Main Grid - Bento Style */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
        {/* Revenue Chart - Large */}
        <div className='lg:col-span-4'>
          <Suspense fallback={<ChartSkeleton className='h-full' />}>
            <RevenueChartData />
          </Suspense>
        </div>

        {/* Recent Payments */}
        <div className='lg:col-span-3'>
          <Suspense fallback={<TableSkeleton />}>
            <RecentPaymentsTableData />
          </Suspense>
        </div>
      </div>

      {/* Second Row */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {/* Plan Distribution */}
        <Suspense fallback={<ChartSkeleton />}>
          <PlanDistributionChartData />
        </Suspense>

        {/* Payment Methods */}
        <Suspense fallback={<ChartSkeleton />} key={`payment-${dateRange.from}-${dateRange.to}`}>
          <PaymentMethodChartData dateRange={dateRange} />
        </Suspense>

        {/* Subscriptions Flow */}
        <div className='md:col-span-2'>
          <Suspense fallback={<ChartSkeleton className='h-full' />}>
            <SubscriptionsFlowChartData />
          </Suspense>
        </div>
      </div>

      {/* Alerts Row - Expiring & Inactive */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        {/* Expiring Subscriptions */}
        <Suspense fallback={<TableSkeleton />}>
          <ExpiringSubscriptionsTableData />
        </Suspense>

        {/* Inactive Customers */}
        <Suspense fallback={<TableSkeleton />}>
          <InactiveCustomersTableData />
        </Suspense>
      </div>
    </>
  );
}

export default async function AdminDashboard({ searchParams }: DashboardProps) {
  const params = await Promise.resolve(searchParams);
  const dateRange = getDateRangeFromPeriod(params.period, params.from, params.to);
  const periodLabel = getPeriodLabel(params.period);
  
  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-6 p-1'>
        <DashboardClientContainer periodLabel={periodLabel}>
          <DashboardServerContent dateRange={dateRange} />
        </DashboardClientContainer>
      </div>
    </PageContainer>
  );
}
