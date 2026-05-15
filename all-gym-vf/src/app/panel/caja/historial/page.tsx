import PageContainer from "@/components/layout/page-container";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
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
