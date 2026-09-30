import { NextRequest } from "next/server";
import { customerDetailSchema } from "@/features/customers/lib/local-customers";
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
