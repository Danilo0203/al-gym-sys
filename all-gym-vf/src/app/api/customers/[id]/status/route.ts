import { NextRequest } from "next/server";
import { reconcileCustomerMutation } from "../../_device-sync";
import { proxyCustomersRequest } from "../../_lib";

interface CustomerStatusRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: CustomerStatusRouteContext) {
  const { id } = await context.params;

  const response = await proxyCustomersRequest(request, `/customers/${id}/status`, {
    method: "PATCH",
    withJsonBody: true,
  });
  return reconcileCustomerMutation(response, id);
}
