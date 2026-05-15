import { notFound } from "next/navigation";
import { getCustomerProfile } from "@/features/customers/actions/customer-history-actions";
import { getCustomerRoutineWorkspace } from "@/features/customers/actions/customer-routine-actions";
import { RoutineActivePage } from "@/features/customers/components/customer-history/routine-active-page";

interface RoutineActiveRoutePageProps {
  params: Promise<{ customerId: string }>;
}

export default async function RoutineActiveRoutePage({ params }: RoutineActiveRoutePageProps) {
  const { customerId } = await params;

  const [profile, workspace] = await Promise.all([
    getCustomerProfile(customerId),
    getCustomerRoutineWorkspace(customerId),
  ]);

  if (!profile) {
    notFound();
  }

  return (
    <RoutineActivePage
      customerId={customerId}
      customerName={profile.full_name || "Cliente"}
      workspace={workspace}
    />
  );
}
