"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconBarcode, IconLoader2, IconMinus, IconPlus, IconShoppingCart, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  searchCashProducts,
  sellProductsFromCashSession,
  type CashProductSearchResult,
  type PaymentMethod,
} from "@/features/cash/actions/cash-actions";

interface CartItem extends CashProductSearchResult {
  quantity: number;
}

function formatMoney(amount: number | null | undefined) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function ProductThumb({ product }: { product: CashProductSearchResult }) {
  if (!product.image_url) {
    return <div className="size-10 rounded-md border bg-muted" />;
  }

  return (
    <div
      className="size-10 rounded-md border bg-cover bg-center"
      style={{ backgroundImage: `url(${product.image_url})` }}
      aria-label={`Imagen de ${product.name}`}
    />
  );
}

export function QuickProductSalePanel({ canSell }: { canSell: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CashProductSearchResult[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isSearching, startSearchTransition] = useTransition();
  const [isSelling, startSaleTransition] = useTransition();

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.sale_price * item.quantity, 0),
    [cart],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) {
      return;
    }

    const timer = window.setTimeout(() => {
      startSearchTransition(async () => {
        try {
          const products = await searchCashProducts(search);
          setResults(products);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "No se pudieron buscar productos");
        }
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [query]);

  function addToCart(product: CashProductSearchResult, quantity = 1) {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }

      return [...current, { ...product, quantity }];
    });
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((current) =>
      current
        .map((item) => (item.id === productId ? { ...item, quantity: Math.max(0, quantity) } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  async function onEnterSearch() {
    const search = query.trim();
    if (!search) return;

    const products = results.length > 0 ? results : await searchCashProducts(search);
    const exactMatch =
      products.find((product) => product.barcode === search || product.sku === search) ||
      (products.length === 1 ? products[0] : null);

    if (!exactMatch) {
      setResults(products);
      toast.info("Selecciona un producto de la lista.");
      return;
    }

    addToCart(exactMatch);
  }

  function onSubmitSale() {
    if (cart.length === 0) {
      toast.error("Agrega al menos un producto.");
      return;
    }

    startSaleTransition(async () => {
      try {
        const sale = await sellProductsFromCashSession({
          paymentMethod,
          items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
        });
        toast.success(`Venta ${sale.sale_number} registrada por ${formatMoney(sale.total_amount)}`);
        setCart([]);
        setQuery("");
        setResults([]);
        router.refresh();
        inputRef.current?.focus();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo registrar la venta");
      }
    });
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <IconShoppingCart className="size-5" />
            Venta rápida de productos
          </CardTitle>
          <CardDescription>Busca por nombre, SKU o código de barras. Enter agrega al carrito.</CardDescription>
        </div>
        <Badge variant="secondary">{formatMoney(cartTotal)}</Badge>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="product-sale-search">Producto</Label>
            <div className="relative">
              <IconBarcode className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                id="product-sale-search"
                value={query}
                onChange={(event) => {
                  const value = event.target.value;
                  setQuery(value);
                  if (value.trim().length < 2) {
                    setResults([]);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onEnterSearch();
                  }
                }}
                className="pl-9"
                placeholder="Escanea o escribe el producto"
                disabled={!canSell || isSelling}
              />
            </div>
          </div>

          <div className="min-h-[16rem] rounded-md border">
            {isSearching ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                Buscando productos...
              </div>
            ) : results.length === 0 ? (
              <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                Escribe al menos 2 caracteres o escanea un código.
              </div>
            ) : (
              <div className="divide-y">
                {results.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                    onClick={() => addToCart(product)}
                    disabled={!canSell || isSelling}
                  >
                    <ProductThumb product={product} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{product.name}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {product.barcode || product.sku || "Sin código"} · Stock {formatQuantity(product.stock_quantity)}
                      </span>
                    </span>
                    <span className="font-semibold">{formatMoney(product.sale_price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Carrito</p>
              <p className="text-sm text-muted-foreground">{cart.length} productos</p>
            </div>
            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex max-h-[22rem] flex-1 flex-col gap-2 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex min-h-36 items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
                Sin productos en el carrito.
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{formatMoney(item.sale_price)} c/u</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => updateQuantity(item.id, 0)}>
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                        <IconMinus className="size-4" />
                      </Button>
                      <Input
                        value={item.quantity}
                        onChange={(event) => updateQuantity(item.id, Number(event.target.value))}
                        type="number"
                        min="0"
                        step="1"
                        className="w-20 text-center"
                      />
                      <Button variant="outline" size="icon" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                        <IconPlus className="size-4" />
                      </Button>
                    </div>
                    <strong>{formatMoney(item.sale_price * item.quantity)}</strong>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-4">
            <div className="mb-3 flex items-center justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{formatMoney(cartTotal)}</span>
            </div>
            <Button className="w-full" disabled={!canSell || isSelling || cart.length === 0} onClick={onSubmitSale}>
              {isSelling ? <IconLoader2 className="animate-spin" /> : <IconShoppingCart />}
              Cobrar productos
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
