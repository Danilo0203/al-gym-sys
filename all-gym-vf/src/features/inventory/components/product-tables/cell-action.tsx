"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconEdit } from "@tabler/icons-react";
import type { Product, ProductPermissions } from "./columns";
import { ProductFormSheet } from "../product-form-sheet";
import { InventoryActionDialog } from "../inventory-action-dialog";
import { ProductDeactivateButton } from "../product-row-actions";

interface CellActionProps {
  data: Product;
  permissions: ProductPermissions;
}

export function CellAction({ data, permissions }: CellActionProps) {
  const [openEdit, setOpenEdit] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1">
      {permissions.canAdjustInventory ? <InventoryActionDialog product={data} /> : null}
      {permissions.canUpdate ? (
        <>
          <ProductFormSheet
            product={data}
            open={openEdit}
            onOpenChange={setOpenEdit}
            trigger={
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <IconEdit className="h-4 w-4 text-blue-500" />
                <span className="sr-only">Editar</span>
              </Button>
            }
          />
        </>
      ) : null}
      {permissions.canDelete && data.is_active ? (
        <ProductDeactivateButton productId={data.id} size="icon" />
      ) : null}
    </div>
  );
}
