import { redirect } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { ProductsListing } from "@/features/inventory/components/products-listing";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
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
