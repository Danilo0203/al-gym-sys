"use client";

import { useTransition } from "react";
import { IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deactivateProduct } from "@/features/inventory/actions/inventory-actions";
export function ProductDeactivateButton({
  productId,
  size = "sm",
}: {
  productId: string;
  size?: "sm" | "default" | "icon";
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size={size === "icon" ? "icon" : size}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await deactivateProduct(productId);
          if (!result.success) {
            toast.error(result.error || "No se pudo desactivar el producto");
            return;
          }

          toast.success("Producto desactivado");
        });
      }}
    >
      {size === "icon" ? <IconTrash className="h-4 w-4" /> : "Desactivar"}
    </Button>
  );
}
