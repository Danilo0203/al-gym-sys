import { notFound } from "next/navigation";
import { getCustomerProfile } from "@/features/customers/actions/customer-history-actions";
import { getCustomerRoutineWorkspace } from "@/features/customers/actions/customer-routine-actions";
import { RoutineDraftPage } from "@/features/customers/components/customer-history/routine-draft-page";

interface RoutineDraftRoutePageProps {
  params: Promise<{ customerId: string }>;
}

export default async function RoutineDraftRoutePage({ params }: RoutineDraftRoutePageProps) {
  const { customerId } = await params;

  const [profile, workspace] = await Promise.all([
    getCustomerProfile(customerId),
    getCustomerRoutineWorkspace(customerId),
  ]);

  if (!profile) {
    notFound();
  }

  return (
    <RoutineDraftPage
      customerId={customerId}
      customerName={profile.full_name || "Cliente"}
      workspace={workspace}
    />
  );
}
