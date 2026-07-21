import { NextRequest } from "next/server";
import { proxyCustomersRequest } from "../../_lib";

interface CustomerStatusRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: CustomerStatusRouteContext) {
  const { id } = await context.params;

  return proxyCustomersRequest(request, `/customers/${id}/status`, {
    method: "PATCH",
    withJsonBody: true,
  });
}
