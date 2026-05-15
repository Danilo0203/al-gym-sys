"use client";

import { useRef, useState, useTransition } from "react";
import { IconLoader2, IconPlus } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { saveProduct, type ProductInventoryItem } from "@/features/inventory/actions/inventory-actions";

interface ProductFormSheetProps {
  product?: ProductInventoryItem | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ProductFormSheet({
  product = null,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ProductFormSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [costPrice, setCostPrice] = useState(product?.cost_price ?? 0);
  const [salePrice, setSalePrice] = useState(product?.sale_price ?? 0);
  const formRef = useRef<HTMLFormElement | null>(null);
  const isEditing = Boolean(product);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange || setInternalOpen : setInternalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setIsActive(product?.is_active ?? true);
      setCostPrice(product?.cost_price ?? 0);
      setSalePrice(product?.sale_price ?? 0);
    }
    setOpen(nextOpen);
  };

  const profit = salePrice - costPrice;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("is_active", String(isActive));

    startTransition(async () => {
      const result = await saveProduct(formData);
      if (!result.success) {
        toast.error(result.error || "No se pudo guardar el producto");
        return;
      }

      toast.success(isEditing ? "Producto actualizado" : "Producto creado");
      setOpen(false);
      formRef.current?.reset();
    });
  }

  const defaultTrigger = (
    <Button size="sm">
      <IconPlus data-icon="inline-start" />
      Nuevo producto
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {trigger !== undefined ? (
        trigger ? (
          <SheetTrigger asChild>{trigger}</SheetTrigger>
        ) : null
      ) : (
        <SheetTrigger asChild>{defaultTrigger}</SheetTrigger>
      )}
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEditing ? "Editar producto" : "Nuevo producto"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modifica los datos del producto."
              : "Registra imagen, código, costo y precio de venta en GTQ."}
          </SheetDescription>
        </SheetHeader>

        <form ref={formRef} onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
            {product ? <input type="hidden" name="id" value={product.id} /> : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="product-name">Nombre</Label>
              <Input id="product-name" name="name" defaultValue={product?.name || ""} required minLength={2} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="product-sku">SKU</Label>
                <Input id="product-sku" name="sku" defaultValue={product?.sku || ""} placeholder="Opcional" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="product-barcode">Código de barras</Label>
                <Input
                  id="product-barcode"
                  name="barcode"
                  defaultValue={product?.barcode || ""}
                  placeholder="Escaneable"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="product-cost">Precio costo</Label>
                <Input
                  id="product-cost"
                  name="cost_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={costPrice || ""}
                  onChange={(e) => setCostPrice(Number(e.target.value) || 0)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="product-sale">Precio venta</Label>
                <Input
                  id="product-sale"
                  name="sale_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={salePrice || ""}
                  onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Ganancia unitaria</Label>
              <Input
                type="text"
                value={new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(profit)}
                disabled
                className={profit >= 0 ? "text-emerald-600" : "text-red-500"}
              />
            </div>

            {isEditing ? (
              <div className="flex flex-col gap-2">
                <Label>Stock actual</Label>
                <Input type="text" value={product?.stock_quantity ?? 0} disabled />
                <p className="text-xs text-muted-foreground">El stock se ajusta desde el panel de Inventario.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="product-quantity">Cantidad inicial</Label>
                <Input
                  id="product-quantity"
                  name="initial_quantity"
                  type="number"
                  min="0"
                  step="0.001"
                  defaultValue={0}
                />
                <p className="text-xs text-muted-foreground">
                  Stock con el que arranca el producto. Déjalo en 0 si aún no tienes unidades.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="product-image">Imagen</Label>
              <Input id="product-image" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
              {product?.image_url ? (
                <div
                  className="h-28 rounded-md border bg-cover bg-center"
                  style={{ backgroundImage: `url(${product.image_url})` }}
                  aria-label={`Imagen actual de ${product.name}`}
                />
              ) : null}
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="product-active">Producto activo</Label>
                <p className="text-sm text-muted-foreground">Los productos inactivos no aparecen en la venta rápida.</p>
              </div>
              <Switch id="product-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t px-6 py-4">
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <IconLoader2 data-icon="inline-start" className="animate-spin" /> : null}
              {isEditing ? "Guardar cambios" : "Crear producto"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
