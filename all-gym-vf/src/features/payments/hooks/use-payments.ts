import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getPayments, GetPaymentsParams } from '../actions/get-payments';

export function usePayments(params: GetPaymentsParams) {
  return useQuery({
    queryKey: ['payments', params],
    queryFn: () => getPayments(params),
    placeholderData: keepPreviousData,
  });
}
