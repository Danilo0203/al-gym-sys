import { NextRequest } from "next/server";
import { proxyCustomersRequest } from "../../_lib";

interface CustomerRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: CustomerRouteContext) {
  const { id } = await context.params;

  return proxyCustomersRequest(request, `/customers/${id}/membership`, {
    method: "GET",
  });
}

export async function POST(request: NextRequest, context: CustomerRouteContext) {
  const { id } = await context.params;

  return proxyCustomersRequest(request, `/customers/${id}/membership`, {
    method: "POST",
    withJsonBody: true,
  });
}
