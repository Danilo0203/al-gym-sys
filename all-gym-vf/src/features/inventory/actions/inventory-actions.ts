"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { localProductImageUrl } from "@/lib/media/local-product-image-url";

export type InventoryMovementType = "entry" | "sale" | "manual_exit" | "adjustment" | "void";
export type PaymentMethod = "cash" | "card" | "transfer";

export interface ProductInventoryItem {
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
}

export interface InventoryMovementItem {
  id: string;
  product_id: string;
  product_name: string;
  movement_type: InventoryMovementType;
  quantity_delta: number;
  quantity_before: number | null;
  quantity_after: number | null;
  unit_cost: number | null;
  unit_price: number | null;
  source_product_sale_id: string | null;
  sale_number: string | null;
  created_by_name: string | null;
  note: string | null;
  created_at: string;
}

export interface ProductListingFilters {
  page?: number;
  perPage?: number;
  name?: string | null;
  isActive?: string | null;
}

export interface InventoryMovementFilters {
  page?: number;
  perPage?: number;
  productName?: string | null;
  movementType?: string | null;
}

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function normalizeNullableText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function requireInventoryPermission(permission: string) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !access.userId) throw new Error("No autenticado");
  if (!hasPermission(access, permission)) throw new Error("No autorizado");
  return access;
}

async function localHeaders(contentType?: string) {
  const cookieStore = await cookies();
  const headers = new Headers();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  if (cookieHeader) headers.set("cookie", cookieHeader);
  if (contentType) headers.set("content-type", contentType);
  return headers;
}

async function inventoryRequest(path: string, init: RequestInit = {}) {
  const headers = await localHeaders(init.body ? "application/json" : undefined);
  return fetchAuthBackend(`/inventory${path}`, { ...init, headers });
}

async function responseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return payload?.error?.message || fallback;
}

function revalidateInventory() {
  revalidatePath("/panel/inventario/productos");
  revalidatePath("/panel/inventario/movimientos");
  revalidatePath("/panel/caja");
  revalidatePath("/panel/resumen");
}

export async function getProductsListing(filters: ProductListingFilters = {}) {
  await requireInventoryPermission("products.view");
  const query = new URLSearchParams({
    page: String(filters.page && filters.page > 0 ? filters.page : 1),
    perPage: String(filters.perPage && filters.perPage > 0 ? filters.perPage : 10),
  });
  if (filters.name?.trim()) query.set("name", filters.name.trim());
  if (filters.isActive?.trim()) query.set("isActive", filters.isActive.trim());
  const response = await inventoryRequest(`/products?${query.toString()}`);
  if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los productos"));
  const payload = await response.json() as { data: ProductInventoryItem[]; total: number };
  return {
    ...payload,
    data: payload.data.map((product) => ({
      ...product,
      image_url: localProductImageUrl(product.image_url),
    })),
  };
}

async function productImageBase64(imageFile: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(imageFile.type)) {
    throw new Error("La imagen debe ser JPG, PNG, WebP o GIF.");
  }
  if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("La imagen no puede superar 5 MB.");
  }
  return Buffer.from(await imageFile.arrayBuffer()).toString("base64");
}

export async function saveProduct(formData: FormData) {
  const productId = normalizeNullableText(formData.get("id"));
  await requireInventoryPermission(productId ? "products.update" : "products.create");
  const name = normalizeNullableText(formData.get("name"));
  const costPrice = Number(formData.get("cost_price") || 0);
  const salePrice = Number(formData.get("sale_price") || 0);
  const initialQuantity = Number(formData.get("initial_quantity") || 0);
  if (!name || name.length < 2) return { success: false, error: "Ingresa el nombre del producto." };
  if (!Number.isFinite(costPrice) || costPrice < 0) return { success: false, error: "El precio costo no es válido." };
  if (!Number.isFinite(salePrice) || salePrice < 0) return { success: false, error: "El precio venta no es válido." };
  if (!productId && (!Number.isFinite(initialQuantity) || initialQuantity < 0)) {
    return { success: false, error: "La cantidad inicial no es válida." };
  }

  try {
    const imageFile = formData.get("image");
    const imageBase64 = imageFile instanceof File && imageFile.size > 0
      ? await productImageBase64(imageFile) : undefined;
    const payload = {
      name,
      sku: normalizeNullableText(formData.get("sku")),
      barcode: normalizeNullableText(formData.get("barcode")),
      costPrice,
      salePrice,
      isActive: formData.get("is_active") !== "false",
      ...(imageBase64 ? { image_base64: imageBase64 } : {}),
      ...(!productId ? { initialQuantity } : {}),
    };
    const productPath = productId ? `/products/${encodeURIComponent(productId)}` : "/products";
    const response = await inventoryRequest(
      imageBase64 ? `${productPath}/with-image` : productPath,
      { method: productId ? "PUT" : "POST", body: JSON.stringify(payload) },
    );
    if (!response.ok) return { success: false, error: await responseError(response, "No se pudo guardar el producto") };
    revalidateInventory();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo guardar el producto" };
  }
}

export async function deactivateProduct(productId: string) {
  await requireInventoryPermission("products.delete");
  const response = await inventoryRequest(`/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
  if (!response.ok) return { success: false, error: await responseError(response, "No se pudo desactivar el producto") };
  revalidateInventory();
  return { success: true };
}

export async function recordInventoryMovement(input: {
  productId: string;
  movementType: "entry" | "manual_exit";
  quantity: number;
  unitCost?: number | null;
  note?: string | null;
}) {
  await requireInventoryPermission("inventory.adjust");
  const response = await inventoryRequest(`/products/${encodeURIComponent(input.productId)}/movements`, {
    method: "POST",
    body: JSON.stringify({
      movementType: input.movementType,
      quantity: input.quantity,
      unitCost: input.unitCost ?? null,
      note: input.note?.trim() || null,
    }),
  });
  if (!response.ok) return { success: false, error: await responseError(response, "No se pudo registrar el movimiento") };
  revalidateInventory();
  return { success: true };
}

export async function adjustProductStock(input: { productId: string; countedQuantity: number; note?: string | null }) {
  await requireInventoryPermission("inventory.adjust");
  const response = await inventoryRequest(`/products/${encodeURIComponent(input.productId)}/adjust`, {
    method: "POST",
    body: JSON.stringify({ countedQuantity: input.countedQuantity, note: input.note?.trim() || null }),
  });
  if (!response.ok) return { success: false, error: await responseError(response, "No se pudo ajustar el inventario") };
  revalidateInventory();
  return { success: true };
}

export async function getInventoryMovements(filters: InventoryMovementFilters = {}) {
  await requireInventoryPermission("inventory.view");
  const query = new URLSearchParams({
    page: String(filters.page && filters.page > 0 ? filters.page : 1),
    perPage: String(filters.perPage && filters.perPage > 0 ? filters.perPage : 10),
  });
  if (filters.productName?.trim()) query.set("productName", filters.productName.trim());
  if (filters.movementType?.trim()) query.set("movementType", filters.movementType.trim());
  const response = await inventoryRequest(`/movements?${query.toString()}`);
  if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los movimientos de inventario"));
  return await response.json() as { data: InventoryMovementItem[]; total: number };
}
