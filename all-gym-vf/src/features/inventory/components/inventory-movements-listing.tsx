import { getInventoryMovements } from "@/features/inventory/actions/inventory-actions";
import { InventoryMovementsTable } from "./inventory-movements-table";

export async function InventoryMovementsListing({
  page,
  perPage,
  productName,
  movementType,
}: {
  page: number;
  perPage: number;
  productName?: string | null;
  movementType?: string | null;
}) {
  const { data, total } = await getInventoryMovements({ page, perPage, productName, movementType });

  return <InventoryMovementsTable data={data} totalItems={total} />;
}
