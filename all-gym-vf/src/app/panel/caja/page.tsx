import { redirect } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { LocalRuntimeModuleState } from "@/components/layout/local-runtime-module-state";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { isLocalAuthEnabled } from "@/lib/auth/local-auth-server";
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

  if (isLocalAuthEnabled()) {
    return (
      <PageContainer
        scrollable
        pageTitle="Caja actual"
        pageDescription="Venta rápida de productos y acciones operativas del turno."
      >
        <LocalRuntimeModuleState
          moduleName="Caja"
          summary="Caja todavía usa flujos de negocio que no se han terminado de migrar al backend local. Se muestra este estado seguro para evitar excepciones de cliente mientras se completa la transición."
        />
      </PageContainer>
    );
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
