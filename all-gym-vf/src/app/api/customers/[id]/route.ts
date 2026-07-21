import { NextRequest } from "next/server";
import { customerDetailSchema } from "@/features/customers/lib/local-customers";
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

  return proxyCustomersRequest(request, `/customers/${id}`, {
    method: "PATCH",
    withJsonBody: true,
  });
}
