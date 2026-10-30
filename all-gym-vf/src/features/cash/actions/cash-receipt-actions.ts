"use server";

import { cookies } from "next/headers";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";

export interface SaleReceipt {
  movementId: string; reference: string; date: string; customer: string; cashier: string;
  method: string; status: string; note: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number; discount: number; total: number;
}
export interface DeviceOperation {
  id: string; kind: string; status: "pending" | "dispatching" | "sent" | "failed" | "unknown" | "expired";
  message: string | null; created_at?: string; movement_id?: string | null;
}
export interface CashDeviceStatus {
  configured: boolean; automaticDrawer: boolean; printerName: string | null; operations: DeviceOperation[];
}
export interface SalesHistory {
  data: Array<{ id: string; date: string; reference: string; customer: string; cashier: string;
    method: string; total: number; status: string; category: string }>;
  total: number; page: number; pageSize: number;
}

async function request<T>(path: string, body?: object): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  const response = await fetchAuthBackend("/cash" + path, {
    method: body ? "POST" : "GET",
    headers: { ...(cookieHeader && { cookie: cookieHeader }), "content-type": "application/json" },
    ...(body && { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "No se pudo completar la solicitud");
  return payload as T;
}
export async function getSaleReceipt(id: string, byPayment = false): Promise<SaleReceipt> {
  return request("/" + (byPayment ? "payments" : "sales") + "/" + encodeURIComponent(id) + "/receipt");
}
export async function printSaleReceipt(movementId: string, requestId: string): Promise<{ id: string }> {
  return request("/sales/" + encodeURIComponent(movementId) + "/receipt", { requestId });
}
export async function getCashDeviceStatus(): Promise<CashDeviceStatus> { return request("/devices"); }
export async function getDeviceOperation(id: string): Promise<DeviceOperation> {
  return request("/devices/operations/" + encodeURIComponent(id));
}
export async function openCashDrawer(requestId: string, reason: string): Promise<{ id: string }> {
  return request("/devices/drawer", { requestId, reason });
}
export async function getSalesHistory(filters: { page?: string; search?: string; dateFrom?: string; dateTo?: string }): Promise<SalesHistory> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return request("/sales?" + params.toString());
}
