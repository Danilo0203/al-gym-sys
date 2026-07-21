import { CustomerHistoryClient } from "@/features/customers/components/customer-history/customer-history-client";
import { serverGetCustomerRoutineWorkspace } from "@/features/customers/lib/customer-routine-server-api";
import { serverGetCustomerHistory } from "@/features/customers/lib/customer-history-server-api";
import { notFound } from "next/navigation";

export default async function CustomerHistoryWrapper({ customerId }: { customerId: string }) {
  const [history, routineWorkspace] = await Promise.all([
    serverGetCustomerHistory(customerId),
    serverGetCustomerRoutineWorkspace(customerId),
  ]);

  if (!history || !routineWorkspace) {
    notFound();
  }

  return (
    <CustomerHistoryClient
      profile={history.profile}
      kpis={history.kpis}
      accessHistory={history.access_history}
      paymentHistory={history.payment_history}
      subscriptionHistory={history.subscription_history}
      bodyAssessments={history.body_assessments}
      heatmapData={history.heatmap_data}
      routineWorkspace={routineWorkspace}
    />
  );
}
