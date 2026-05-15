import { getProductsListing } from "@/features/inventory/actions/inventory-actions";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { searchParamsCache } from "@/lib/searchparams";
import { ProductTable } from "@/features/inventory/components/product-tables/product-table";
import type { Product } from "@/features/inventory/components/product-tables/columns";

function toProduct(item: {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
  is_active: boolean;
  last_movement_at: string | null;
  updated_at: string;
}): Product {
  return { ...item };
}

export async function ProductsListing() {
  const access = await getUserAccessContext();
  const canCreate = hasPermission(access, "products.create");
  const canUpdate = hasPermission(access, "products.update");
  const canDelete = hasPermission(access, "products.delete");
  const canAdjustInventory = hasPermission(access, "inventory.adjust");

  const page = searchParamsCache.get("page");
  const perPage = searchParamsCache.get("perPage");
  const name = searchParamsCache.get("name");
  const isActive = searchParamsCache.get("is_active");

  const { data, total } = await getProductsListing({ page, perPage, name, isActive });

  return (
    <ProductTable
      data={data.map(toProduct)}
      totalItems={total}
      canCreate={canCreate}
      permissions={{ canUpdate, canDelete, canAdjustInventory }}
    />
  );
}
