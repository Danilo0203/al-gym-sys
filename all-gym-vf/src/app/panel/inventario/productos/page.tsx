import { redirect } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { LocalRuntimeModuleState } from "@/components/layout/local-runtime-module-state";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { ProductsListing } from "@/features/inventory/components/products-listing";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { isLocalAuthEnabled } from "@/lib/auth/local-auth-server";
import { searchParamsCache } from "@/lib/searchparams";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

export const metadata = {
  title: "Panel: Productos",
};

type ProductsPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) redirect("/iniciar-sesion");
  if (!hasPermission(access, "products.view")) redirect("/panel");

  if (isLocalAuthEnabled()) {
    return (
      <PageContainer
        scrollable={false}
        pageTitle="Productos"
        pageDescription="Catálogo, precios y stock actual de productos."
      >
        <LocalRuntimeModuleState
          moduleName="Inventario de productos"
          summary="El catálogo de productos todavía no está migrado al backend local. En runtime local se bloquea con un estado controlado para evitar pantallas blancas y errores de cliente."
        />
      </PageContainer>
    );
  }

  const resolvedSearchParams = await searchParams;
  searchParamsCache.parse(resolvedSearchParams);

  return (
    <PageContainer
      scrollable={false}
      pageTitle="Productos"
      pageDescription="Catálogo, precios y stock actual de productos."
    >
      <Suspense fallback={<DataTableSkeleton columnCount={7} rowCount={8} filterCount={2} />}>
        <ProductsListing />
      </Suspense>
    </PageContainer>
  );
}
