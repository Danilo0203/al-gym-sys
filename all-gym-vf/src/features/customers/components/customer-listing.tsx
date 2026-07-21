import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CustomerTable } from "./customer-tables/customer-table";
import { searchParamsCache } from "@/lib/searchparams";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import {
  mapCustomerListQuery,
  parseCustomerListResponse,
  parseCustomerApiResponse,
  sortingStateToBackendSort,
} from "@/features/customers/lib/local-customers";

export default async function CustomerListingPage() {
  const access = await getUserAccessContext();
  const canUpdate = hasPermission(access, "customers.update");

  const page = searchParamsCache.get("page");
  const pageSize = searchParamsCache.get("perPage");
  const search = searchParamsCache.get("full_name");
  const sort = sortingStateToBackendSort(searchParamsCache.get("sort"));
  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  const query = mapCustomerListQuery({
    page,
    pageSize,
    search,
    sort,
  });

  let listResponse;

  try {
    const response = await fetchAuthBackend(`/customers?${query.toString()}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });

    listResponse = await parseCustomerApiResponse(response, parseCustomerListResponse);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      typeof error.status === "number" &&
      error.status === 401
    ) {
      redirect("/iniciar-sesion");
    }

    throw error;
  }

  return (
    <CustomerTable
      data={listResponse.data.map((customer) => ({
        ...customer,
        subscription_start_date: null,
        subscription_end_date: null,
        last_check_in: null,
      }))}
      totalItems={listResponse.meta.total}
      canUpdate={canUpdate}
    />
  );
}
