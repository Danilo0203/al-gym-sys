import { NextRequest, NextResponse } from "next/server";
import { removeDeletedCustomerFromClock } from "@/features/cash/lib/local-device-sync";
import { customerDetailSchema, deletedCustomerSchema } from "@/features/customers/lib/local-customers";
import { reconcileCustomerMutation } from "../_device-sync";
import { proxyCustomersRequest, proxyValidatedCustomersGet } from "../_lib";

interface CustomerRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: CustomerRouteContext) {
  const { id } = await context.params;

  return proxyValidatedCustomersGet(request, `/customers/${id}`, customerDetailSchema);
}

export async function PATCH(request: NextRequest, context: CustomerRouteContext) {
  const { id } = await context.params;
  const body = await request.clone().json().catch(() => null) as Record<string, unknown> | null;
  const response = await proxyCustomersRequest(request, `/customers/${id}`, {
    method: "PATCH",
    withJsonBody: true,
  });
  return body && Object.hasOwn(body, "full_name")
    ? reconcileCustomerMutation(response, id)
    : response;
}

export async function DELETE(request: NextRequest, context: CustomerRouteContext) {
  const { id } = await context.params;
  const response = await proxyCustomersRequest(request, `/customers/${id}`, { method: "DELETE" });
  if (!response.ok) return response;

  const deleted = deletedCustomerSchema.safeParse(await response.json().catch(() => null));
  if (!deleted.success) {
    return NextResponse.json(
      { error: { code: "INVALID_UPSTREAM_RESPONSE", message: "Respuesta inválida al eliminar el cliente" } },
      { status: 502 },
    );
  }

  // The customer is already deleted; a clock failure must not undo that, only be reported.
  let clockRemoval: "queued" | "pending" | "not_needed" = "not_needed";
  if (deleted.data.biometric_id !== null) {
    const result = await removeDeletedCustomerFromClock(deleted.data.biometric_id, deleted.data.full_name);
    clockRemoval = result.queued ? "queued" : "pending";
    if (!result.queued) {
      console.warn("[device-sync] No se pudo encolar el borrado en el reloj", {
        customerId: id,
        biometricId: deleted.data.biometric_id,
      });
    }
  }

  return NextResponse.json({ ...deleted.data, clock_removal: clockRemoval });
}
