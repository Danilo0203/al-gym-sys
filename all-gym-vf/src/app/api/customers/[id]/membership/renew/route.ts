import { NextRequest } from "next/server";
import { reconcileCustomerMutation } from "../../../_device-sync";
import { proxyCustomersRequest } from "../../../_lib";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const response = await proxyCustomersRequest(request, `/customers/${id}/membership/renew`, {
    method: "POST",
    withJsonBody: true,
  });
  return reconcileCustomerMutation(response, id);
}
