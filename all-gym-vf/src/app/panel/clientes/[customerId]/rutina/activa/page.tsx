import { notFound } from "next/navigation";
import { RoutineActivePage } from "@/features/customers/components/customer-history/routine-active-page";
import { serverGetCustomerRoutineWorkspace } from "@/features/customers/lib/customer-routine-server-api";
import { serverGetCustomerById } from "@/features/customers/lib/customer-server-api";

interface RoutineActiveRoutePageProps {
  params: Promise<{ customerId: string }>;
}

export default async function RoutineActiveRoutePage({ params }: RoutineActiveRoutePageProps) {
  const { customerId } = await params;

  const [profile, workspace] = await Promise.all([
    serverGetCustomerById(customerId),
    serverGetCustomerRoutineWorkspace(customerId),
  ]);

  if (!profile || !workspace) {
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
