import { MasterDetailLayout } from "@/features/customers/components/customer-history/master-detail-layout";

interface CustomerLayoutProps {
  children: React.ReactNode;
  params: Promise<{ customerId: string }>;
}

export default async function CustomerDetailLayout({ children, params }: CustomerLayoutProps) {
  await params;
  return <MasterDetailLayout initialCustomers={[]}>{children}</MasterDetailLayout>;
}
