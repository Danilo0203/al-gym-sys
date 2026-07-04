import { useQuery } from "@tanstack/react-query";
import { getPlans, getCustomerMembership, Plan, Membership } from "../lib/local-memberships";

export const membershipsKeys = {
  all: ["memberships"] as const,
  plans: () => [...membershipsKeys.all, "plans"] as const,
  membership: (customerId: string) => [...membershipsKeys.all, "membership", customerId] as const,
};

export function useLocalPlans() {
  return useQuery<Plan[]>({
    queryKey: membershipsKeys.plans(),
    queryFn: getPlans,
  });
}

export function useLocalMembership(customerId: string | undefined | null) {
  return useQuery<Membership | null>({
    queryKey: membershipsKeys.membership(customerId || ""),
    queryFn: () => getCustomerMembership(customerId!),
    enabled: Boolean(customerId),
  });
}
