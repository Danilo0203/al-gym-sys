import { MasterDetailLayout } from "@/features/customers/components/customer-history/master-detail-layout";
import type { CustomerListItem } from "@/features/customers/components/customer-history/customer-list";
import { serverGetCustomersList } from "@/features/customers/lib/customer-server-api";

const INITIAL_CUSTOMERS_LIMIT = 24;

interface CustomerLayoutProps {
  children: React.ReactNode;
  params: Promise<{ customerId: string }>;
}

export default async function CustomerDetailLayout({ children, params }: CustomerLayoutProps) {
  await params;
  const customersResponse = await serverGetCustomersList({
    page: 1,
    pageSize: INITIAL_CUSTOMERS_LIMIT,
    sort: "full_name",
  });

  const customers: CustomerListItem[] = customersResponse.data.map((customer) => ({
    id: customer.id,
    full_name: customer.full_name,
    avatar_url: customer.avatar_url,
    plan_name: customer.current_membership?.plan_name ?? null,
    subscription_status: customer.current_membership?.status ?? null,
    is_active: customer.is_active,
  }));

  return <MasterDetailLayout initialCustomers={customers}>{children}</MasterDetailLayout>;
}
