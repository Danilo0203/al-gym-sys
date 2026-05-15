import { redirect } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { getCashDashboardData } from "@/features/cash/actions/cash-actions";
import { CashDashboardClient } from "@/features/cash/components/cash-dashboard-client";
import { CashModuleSetupState } from "@/features/cash/components/cash-module-setup-state";
import { isCashModuleNotReadyError } from "@/features/cash/lib/cash-module-errors";

export const metadata = {
  title: "Dashboard: Caja",
};

export default async function CashPage() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect("/iniciar-sesion");
  }

  if (!hasPermission(access, "cash.view")) {
    redirect("/panel");
  }

  let data = null;
  let setupRequired = false;

  try {
    data = await getCashDashboardData();
  } catch (error) {
    if (!isCashModuleNotReadyError(error)) {
      throw error;
    }

    setupRequired = true;
  }

  return (
    <PageContainer
      scrollable
      pageTitle="Caja actual"
      pageDescription="Venta rápida de productos y acciones operativas del turno."
    >
      {setupRequired || !data ? <CashModuleSetupState /> : <CashDashboardClient data={data} />}
    </PageContainer>
  );
}
