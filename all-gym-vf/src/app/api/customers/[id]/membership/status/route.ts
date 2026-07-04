import { NextRequest } from "next/server";
import { proxyCustomersRequest } from "../../../_lib";

interface CustomerRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: CustomerRouteContext) {
  const { id } = await context.params;

  return proxyCustomersRequest(request, `/customers/${id}/membership/status`, {
    method: "PATCH",
    withJsonBody: true,
  });
}
