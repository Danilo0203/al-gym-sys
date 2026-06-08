import { MasterDetailLayout } from "@/features/customers/components/customer-history/master-detail-layout";
import { createClient } from "@/lib/supabase/server";
import { Customer } from "@/features/customers/components/customer-tables/columns";

interface CustomerLayoutProps {
  children: React.ReactNode;
  params: Promise<{ customerId: string }>;
}

export default async function CustomerDetailLayout({ children, params }: CustomerLayoutProps) {
  await params;
  const supabase = await createClient();

  // Fetch all customers for the list (optimized query)
  // We can limit this if there are thousands, but for now fetching all active is fine for smooth UX
  // Or at least fetch a good chunk (e.g., 100)
  const { data: customers } = await supabase
    .from("customer_overview")
    .select(
      "id, full_name, phone, avatar_url, role, subscription_status, subscription_start_date, subscription_end_date, subscription_grace_days, subscription_access_until, plan_name, last_check_in",
    )
    .order("subscription_status", { ascending: true }) // Active first
    .order("full_name", { ascending: true })
    .limit(100); // Reasonable limit for the sidebar for now

  return <MasterDetailLayout customers={(customers as Customer[]) || []}>{children}</MasterDetailLayout>;
}
