import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { searchParamsCache } from "@/lib/searchparams";
import {
  customerMembershipStatusSchema,
  mapCustomerListQuery,
  sortingStateToBackendSort,
} from "@/features/customers/lib/local-customers";
import { CustomerListingClient } from "./customer-listing-client";

export default async function CustomerListingPage() {
  const access = await getUserAccessContext();
  const rawIsActive = searchParamsCache.get("is_active");
  const rawPlanId = Number(searchParamsCache.get("plan_id"));
  const membershipStatus = customerMembershipStatusSchema.safeParse(
    searchParamsCache.get("membership_status"),
  );
  const query = mapCustomerListQuery({
    page: searchParamsCache.get("page"),
    pageSize: searchParamsCache.get("perPage"),
    search: searchParamsCache.get("full_name"),
    sort: sortingStateToBackendSort(searchParamsCache.get("sort")),
    isActive: rawIsActive === "true" ? true : rawIsActive === "false" ? false : undefined,
    planId: Number.isInteger(rawPlanId) && rawPlanId > 0 ? rawPlanId : undefined,
    membershipStatus: membershipStatus.success ? membershipStatus.data : undefined,
  });

  return (
    <CustomerListingClient
      query={query.toString()}
      canUpdate={hasPermission(access, "customers.update")}
    />
  );
}
