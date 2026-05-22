import PageContainer from "@/components/layout/page-container";
import { LocalRuntimeModuleState } from "@/components/layout/local-runtime-module-state";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { isLocalAuthEnabled } from "@/lib/auth/local-auth-server";
import { CashHistoryListingPage } from "@/features/cash/components/cash-history-listing";
import { searchParamsCache } from "@/lib/searchparams";
import { redirect } from "next/navigation";
import { SearchParams } from "nuqs/server";
import { Suspense } from "react";

export const metadata = {
  title: "Dashboard: Historial de Caja",
};

type CashHistoryPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function CashHistoryPage({ searchParams }: CashHistoryPageProps) {
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
        scrollable={false}
        pageTitle="Historial de cajas"
        pageDescription="Consulta aperturas, cierres y diferencias por sesión."
      >
        <LocalRuntimeModuleState
          moduleName="Historial de caja"
          summary="El historial de caja sigue en migración y todavía no debe ejecutarse sobre el runtime local. La app muestra este estado controlado para evitar errores de frontend o consultas remotas no disponibles."
        />
      </PageContainer>
    );
  }

  const resolvedSearchParams = await searchParams;
  searchParamsCache.parse(resolvedSearchParams);

  return (
    <PageContainer
      scrollable={false}
      pageTitle="Historial de cajas"
      pageDescription="Consulta aperturas, cierres y diferencias por sesión."
    >
      <Suspense fallback={<DataTableSkeleton columnCount={8} rowCount={8} filterCount={4} />}>
        <CashHistoryListingPage />
      </Suspense>
    </PageContainer>
  );
}
