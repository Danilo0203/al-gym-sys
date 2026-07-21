import { notFound } from "next/navigation";
import { RoutineDraftPage } from "@/features/customers/components/customer-history/routine-draft-page";
import { serverGetCustomerRoutineWorkspace } from "@/features/customers/lib/customer-routine-server-api";
import { serverGetCustomerById } from "@/features/customers/lib/customer-server-api";

interface RoutineDraftRoutePageProps {
  params: Promise<{ customerId: string }>;
}

export default async function RoutineDraftRoutePage({ params }: RoutineDraftRoutePageProps) {
  const { customerId } = await params;

  const [profile, workspace] = await Promise.all([
    serverGetCustomerById(customerId),
    serverGetCustomerRoutineWorkspace(customerId),
  ]);

  if (!profile || !workspace) {
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
