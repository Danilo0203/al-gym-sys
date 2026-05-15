import { redirect } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { InventoryMovementsListing } from "@/features/inventory/components/inventory-movements-listing";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { searchParamsCache } from "@/lib/searchparams";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

export const metadata = {
  title: "Panel: Movimientos de Inventario",
};

type InventoryMovementsPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function InventoryMovementsPage({ searchParams }: InventoryMovementsPageProps) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) redirect("/iniciar-sesion");
  if (!hasPermission(access, "inventory.view")) redirect("/panel");

  const resolvedSearchParams = await searchParams;
  searchParamsCache.parse(resolvedSearchParams);
  const page = searchParamsCache.get("page");
  const perPage = searchParamsCache.get("perPage");
  const productName = searchParamsCache.get("name");
  const movementType = searchParamsCache.get("category");

  return (
    <PageContainer
      scrollable={false}
      pageTitle="Movimientos de inventario"
      pageDescription="Entradas, salidas, ventas y ajustes físicos de productos."
    >
      <Suspense fallback={<DataTableSkeleton columnCount={8} rowCount={8} filterCount={2} />}>
        <InventoryMovementsListing
          page={page}
          perPage={perPage}
          productName={productName}
          movementType={movementType}
        />
      </Suspense>
    </PageContainer>
  );
}
