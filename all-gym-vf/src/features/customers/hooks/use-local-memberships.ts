import { useQuery } from "@tanstack/react-query";
import {
  getCustomerMembership,
  getPlans,
  type Membership,
  type Plan,
} from "../lib/local-memberships";

export const membershipsKeys = {
  all: ["memberships"] as const,
  plans: () => ["memberships", "plans"] as const,
  membership: (customerId: string) => ["memberships", "membership", customerId] as const,
};

export function useLocalPlans() {
  return useQuery<Plan[]>({
    queryKey: membershipsKeys.plans(),
    queryFn: getPlans,
  });
}

export function useLocalMembership(customerId: string | null | undefined) {
  return useQuery<Membership | null>({
    queryKey: membershipsKeys.membership(customerId ?? ""),
    queryFn: () => getCustomerMembership(customerId!),
    enabled: Boolean(customerId),
  });
}
