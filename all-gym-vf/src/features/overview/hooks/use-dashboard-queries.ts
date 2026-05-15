import { useQuery } from '@tanstack/react-query';
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

export function useDashboardKPIs(dateRange: DashboardDateRange) {
  return useQuery({
    queryKey: ['dashboard', 'kpis', dateRange.from, dateRange.to],
    queryFn: () => getDashboardKPIs(dateRange),
  });
}

export function useRevenueByMonth() {
  return useQuery({
    queryKey: ['dashboard', 'revenue-by-month'],
    queryFn: () => getRevenueByMonth(),
  });
}

export function usePlanDistribution() {
  return useQuery({
    queryKey: ['dashboard', 'plan-distribution'],
    queryFn: () => getPlanDistribution(),
  });
}

export function useSubscriptionsFlow() {
  return useQuery({
    queryKey: ['dashboard', 'subscriptions-flow'],
    queryFn: () => getSubscriptionsFlow(),
  });
}

export function usePaymentMethodDistribution(dateRange: DashboardDateRange) {
  return useQuery({
    queryKey: ['dashboard', 'payment-methods', dateRange.from, dateRange.to],
    queryFn: () => getPaymentMethodDistribution(dateRange),
  });
}

export function useRecentPayments(limit: number = 8) {
  return useQuery({
    queryKey: ['dashboard', 'recent-payments', limit],
    queryFn: () => getRecentPayments(limit),
  });
}

export function useExpiringSubscriptions(limit: number = 7) {
  return useQuery({
    queryKey: ['dashboard', 'expiring-subscriptions', limit],
    queryFn: () => getExpiringSubscriptions(limit),
  });
}

export function useInactiveCustomers(limit: number = 10) {
  return useQuery({
    queryKey: ['dashboard', 'inactive-customers', limit],
    queryFn: () => getInactiveCustomers(limit),
  });
}
