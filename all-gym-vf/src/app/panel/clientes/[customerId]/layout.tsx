import { MasterDetailLayout } from "@/features/customers/components/customer-history/master-detail-layout";
import { createClient } from "@/lib/supabase/server";
import type { CustomerListItem } from "@/features/customers/components/customer-history/customer-list";

const INITIAL_CUSTOMERS_LIMIT = 24;

interface CustomerLayoutProps {
  children: React.ReactNode;
  params: Promise<{ customerId: string }>;
}

export default async function CustomerDetailLayout({ children, params }: CustomerLayoutProps) {
  await params;
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customer_overview")
    .select(
      "id, full_name, avatar_url, plan_name, subscription_status, is_active",
    )
    .eq("role", "client")
    .order("full_name", { ascending: true })
    .limit(INITIAL_CUSTOMERS_LIMIT);

  return <MasterDetailLayout initialCustomers={(customers as CustomerListItem[]) || []}>{children}</MasterDetailLayout>;
}
