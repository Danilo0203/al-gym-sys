import { redirect } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { getCashSessionDetail } from "@/features/cash/actions/cash-actions";
import { CashModuleSetupState } from "@/features/cash/components/cash-module-setup-state";
import { CashSessionDetailView } from "@/features/cash/components/cash-session-detail-view";
import { isCashModuleNotReadyError } from "@/features/cash/lib/cash-module-errors";

export const metadata = {
  title: "Dashboard: Detalle de Caja",
};

type CashSessionDetailPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function CashSessionDetailPage({ params }: CashSessionDetailPageProps) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect("/iniciar-sesion");
  }

  if (!hasPermission(access, "cash.view")) {
    redirect("/panel");
  }

  const canReverseMovements = access.isOwner || hasPermission(access, "cash.operate");

  const { sessionId } = await params;
  let data = null;
  let setupRequired = false;

  try {
    data = await getCashSessionDetail(sessionId);
  } catch (error) {
    if (!isCashModuleNotReadyError(error)) {
      throw error;
    }

    setupRequired = true;
  }

  return (
    <PageContainer
      scrollable
      pageTitle="Detalle de sesión"
      pageDescription="Arqueo, movimientos y trazabilidad completa de la sesión."
    >
      {setupRequired || !data ? (
        <CashModuleSetupState title="Detalle de caja pendiente de inicializacion" />
      ) : (
        <CashSessionDetailView data={data} canReverseMovements={canReverseMovements} />
      )}
    </PageContainer>
  );
}
