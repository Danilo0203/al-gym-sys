"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";

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

interface ProductInventoryRow {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  cost_price: number | string;
  sale_price: number | string;
  stock_quantity: number | string;
  is_active: boolean;
  last_movement_at: string | null;
  updated_at: string;
}

interface InventoryMovementRow {
  id: string;
  product_id: string;
  movement_type: InventoryMovementType;
  quantity_delta: number | string;
  quantity_before: number | string | null;
  quantity_after: number | string | null;
  unit_cost: number | string | null;
  unit_price: number | string | null;
  source_product_sale_id: string | null;
  created_by_user_id: string;
  note: string | null;
  created_at: string;
}

const PRODUCT_IMAGE_BUCKET = "products";
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = typeof value === "number" ? value : Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function normalizeNullableText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function requireInventoryPermission(permission: string) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !access.userId) {
    throw new Error("No autenticado");
  }

  if (!hasPermission(access, permission)) {
    throw new Error("No autorizado");
  }

  return access;
}

function mapProduct(row: ProductInventoryRow): ProductInventoryItem {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    image_url: row.image_url,
    cost_price: toNumber(row.cost_price) || 0,
    sale_price: toNumber(row.sale_price) || 0,
    stock_quantity: toNumber(row.stock_quantity) || 0,
    is_active: row.is_active,
    last_movement_at: row.last_movement_at,
    updated_at: row.updated_at,
  };
}

async function uploadProductImage(productId: string, imageFile: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(imageFile.type)) {
    throw new Error("La imagen debe ser JPG, PNG, WebP o GIF.");
  }

  if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("La imagen no puede superar 5 MB.");
  }

  const extension = imageFile.name.split(".").pop()?.toLowerCase() || "webp";
  const storagePath = `catalog/${productId}/${Date.now()}.${extension}`;
  const adminClient = createAdminClient();
  const buffer = Buffer.from(await imageFile.arrayBuffer());

  const { data, error } = await adminClient.storage.from(PRODUCT_IMAGE_BUCKET).upload(storagePath, buffer, {
    contentType: imageFile.type,
    upsert: true,
    cacheControl: "31536000",
  });

  if (error || !data) {
    throw new Error("No se pudo subir la imagen del producto.");
  }

  const { data: publicUrlData } = adminClient.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(data.path);
  return publicUrlData.publicUrl;
}

export async function getProductsListing(filters: ProductListingFilters = {}) {
  await requireInventoryPermission("products.view");
  const adminClient = createAdminClient();
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const perPage = filters.perPage && filters.perPage > 0 ? filters.perPage : 10;

  let query = adminClient.from("product_inventory_overview").select("*", { count: "exact" });

  if (filters.name) {
    const escapedSearch = filters.name.replace(/[,%]/g, " ").trim();
    if (escapedSearch) {
      query = query.or(`name.ilike.%${escapedSearch}%,sku.ilike.%${escapedSearch}%,barcode.ilike.%${escapedSearch}%`);
    }
  }

  if (filters.isActive) {
    const activeStates = filters.isActive.split(",").filter(Boolean).map((value) => value === "true");
    if (activeStates.length > 0) {
      query = query.in("is_active", activeStates);
    }
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await query.order("name", { ascending: true }).range(from, to);

  if (error) {
    throw new Error("No se pudieron cargar los productos");
  }

  return {
    data: ((data as ProductInventoryRow[] | null) || []).map(mapProduct),
    total: count || 0,
  };
}

export async function saveProduct(formData: FormData) {
  const productId = normalizeNullableText(formData.get("id"));
  const access = await requireInventoryPermission(productId ? "products.update" : "products.create");
  const adminClient = createAdminClient();

  const name = normalizeNullableText(formData.get("name"));
  const sku = normalizeNullableText(formData.get("sku"));
  const barcode = normalizeNullableText(formData.get("barcode"));
  const costPrice = Number(formData.get("cost_price") || 0);
  const salePrice = Number(formData.get("sale_price") || 0);
  const isActive = formData.get("is_active") !== "false";
  const imageFile = formData.get("image");
  const isEditing = Boolean(productId);

  if (!name || name.length < 2) {
    return { success: false, error: "Ingresa el nombre del producto." };
  }

  if (!Number.isFinite(costPrice) || costPrice < 0) {
    return { success: false, error: "El precio costo no es válido." };
  }

  if (!Number.isFinite(salePrice) || salePrice < 0) {
    return { success: false, error: "El precio venta no es válido." };
  }

  const payload = {
    name,
    sku,
    barcode,
    cost_price: costPrice,
    sale_price: salePrice,
    is_active: isActive,
    updated_by_user_id: access.userId,
  };

  const { data: savedProduct, error } = productId
    ? await adminClient.from("products").update(payload).eq("id", productId).select("id").single()
    : await adminClient
        .from("products")
        .insert({ ...payload, created_by_user_id: access.userId })
        .select("id")
        .single();

  if (error || !savedProduct) {
    return {
      success: false,
      error: error?.code === "23505" ? "El SKU o código de barras ya existe." : "No se pudo guardar el producto.",
    };
  }

  if (imageFile instanceof File && imageFile.size > 0) {
    const imageUrl = await uploadProductImage(savedProduct.id, imageFile);
    const { error: imageError } = await adminClient
      .from("products")
      .update({ image_url: imageUrl, updated_by_user_id: access.userId })
      .eq("id", savedProduct.id);

    if (imageError) {
      return { success: false, error: "El producto se guardó, pero no se pudo asociar la imagen." };
    }
  }

  if (!isEditing) {
    const initialQuantity = Number(formData.get("initial_quantity") || 0);
    if (Number.isFinite(initialQuantity) && initialQuantity > 0) {
      const { success: movementOk, error: movementError } = await recordInventoryMovement({
        productId: savedProduct.id,
        movementType: "entry",
        quantity: initialQuantity,
        note: "Stock inicial",
      });
      if (!movementOk) {
        console.warn("No se pudo registrar el stock inicial:", movementError);
      }
    }
  }

  revalidatePath("/panel/inventario/productos");
  revalidatePath("/panel/caja");
  return { success: true };
}

export async function deactivateProduct(productId: string) {
  const access = await requireInventoryPermission("products.delete");
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("products")
    .update({ is_active: false, updated_by_user_id: access.userId })
    .eq("id", productId);

  if (error) {
    return { success: false, error: "No se pudo desactivar el producto." };
  }

  revalidatePath("/panel/inventario/productos");
  revalidatePath("/panel/caja");
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
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_product_inventory_movement", {
    p_product_id: input.productId,
    p_movement_type: input.movementType,
    p_quantity: input.quantity,
    p_unit_cost: input.unitCost ?? null,
    p_note: input.note?.trim() || null,
  });

  if (error) {
    return { success: false, error: error.message || "No se pudo registrar el movimiento." };
  }

  revalidatePath("/panel/inventario/productos");
  revalidatePath("/panel/inventario/movimientos");
  revalidatePath("/panel/caja");
  return { success: true };
}

export async function adjustProductStock(input: { productId: string; countedQuantity: number; note?: string | null }) {
  await requireInventoryPermission("inventory.adjust");
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_product_stock", {
    p_product_id: input.productId,
    p_counted_quantity: input.countedQuantity,
    p_note: input.note?.trim() || null,
  });

  if (error) {
    return { success: false, error: error.message || "No se pudo ajustar el inventario." };
  }

  revalidatePath("/panel/inventario/productos");
  revalidatePath("/panel/inventario/movimientos");
  revalidatePath("/panel/caja");
  return { success: true };
}

export async function getInventoryMovements(filters: InventoryMovementFilters = {}) {
  await requireInventoryPermission("inventory.view");
  const adminClient = createAdminClient();
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const perPage = filters.perPage && filters.perPage > 0 ? filters.perPage : 10;

  let query = adminClient.from("inventory_movements").select("*", { count: "exact" });

  if (filters.productName) {
    const escapedSearch = filters.productName.replace(/[,%]/g, " ").trim();
    if (escapedSearch) {
      const { data: matchingProducts, error: matchingProductsError } = await adminClient
        .from("products")
        .select("id")
        .or(`name.ilike.%${escapedSearch}%,sku.ilike.%${escapedSearch}%,barcode.ilike.%${escapedSearch}%`);

      if (matchingProductsError) {
        throw new Error("No se pudieron filtrar productos");
      }

      const matchingProductIds = ((matchingProducts || []) as Array<{ id: string }>).map((product) => product.id);
      if (matchingProductIds.length === 0) {
        return { data: [] as InventoryMovementItem[], total: 0 };
      }

      query = query.in("product_id", matchingProductIds);
    }
  }

  if (filters.movementType) {
    const types = filters.movementType.split(",").filter(Boolean);
    if (types.length > 0) {
      query = query.in("movement_type", types);
    }
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);

  if (error) {
    throw new Error("No se pudieron cargar los movimientos de inventario");
  }

  const rows = (data as InventoryMovementRow[] | null) || [];
  const productIds = Array.from(new Set(rows.map((row) => row.product_id)));
  const userIds = Array.from(new Set(rows.map((row) => row.created_by_user_id)));
  const saleIds = Array.from(
    new Set(rows.map((row) => row.source_product_sale_id).filter((value): value is string => Boolean(value))),
  );

  const [{ data: products }, { data: users }, { data: sales }] = await Promise.all([
    productIds.length > 0 ? adminClient.from("products").select("id, name").in("id", productIds) : Promise.resolve({ data: [] }),
    userIds.length > 0 ? adminClient.from("profiles").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] }),
    saleIds.length > 0 ? adminClient.from("product_sales").select("id, sale_number").in("id", saleIds) : Promise.resolve({ data: [] }),
  ]);

  const productMap = new Map(((products || []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]));
  const userMap = new Map(
    ((users || []) as Array<{ id: string; full_name: string | null }>).map((row) => [row.id, row.full_name || "Usuario"]),
  );
  const saleMap = new Map(((sales || []) as Array<{ id: string; sale_number: string }>).map((row) => [row.id, row.sale_number]));

  const mappedRows: InventoryMovementItem[] = rows.map((row) => ({
    id: row.id,
    product_id: row.product_id,
    product_name: productMap.get(row.product_id) || "Producto",
    movement_type: row.movement_type,
    quantity_delta: toNumber(row.quantity_delta) || 0,
    quantity_before: toNumber(row.quantity_before),
    quantity_after: toNumber(row.quantity_after),
    unit_cost: toNumber(row.unit_cost),
    unit_price: toNumber(row.unit_price),
    source_product_sale_id: row.source_product_sale_id,
    sale_number: row.source_product_sale_id ? saleMap.get(row.source_product_sale_id) || null : null,
    created_by_name: userMap.get(row.created_by_user_id) || "Usuario",
    note: row.note,
    created_at: row.created_at,
  }));

  return {
    data: mappedRows,
    total: count || 0,
  };
}
