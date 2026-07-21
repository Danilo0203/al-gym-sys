import { MasterDetailLayout } from "@/features/customers/components/customer-history/master-detail-layout";
import type { CustomerListItem } from "@/features/customers/components/customer-history/customer-list";
import { serverGetCustomersList } from "@/features/customers/lib/customer-server-api";
import { CustomerApiError } from "@/features/customers/lib/local-customers";
import { redirect } from "next/navigation";

const INITIAL_CUSTOMERS_LIMIT = 24;

interface CustomerLayoutProps {
  children: React.ReactNode;
  params: Promise<{ customerId: string }>;
}

export default async function CustomerDetailLayout({ children, params }: CustomerLayoutProps) {
  await params;
  let customers: CustomerListItem[] = [];

  try {
    const response = await serverGetCustomersList({
      page: 1,
      pageSize: INITIAL_CUSTOMERS_LIMIT,
      sort: "full_name",
    });

    customers = response.data.map((customer) => ({
      id: customer.id,
      full_name: customer.full_name,
      avatar_url: customer.avatar_url,
      plan_name: customer.current_membership?.plan_name ?? null,
      subscription_status: customer.current_membership?.status ?? null,
      is_active: customer.is_active,
    }));
  } catch (error) {
    if (error instanceof CustomerApiError && error.status === 401) {
      redirect("/iniciar-sesion");
    }

    throw error;
  }

  return <MasterDetailLayout initialCustomers={customers}>{children}</MasterDetailLayout>;
}
