import { NextRequest } from "next/server";
import { proxyCustomersRequest } from "../../_lib";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyCustomersRequest(request, `/customers/${id}/membership`, {
    method: "GET",
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyCustomersRequest(request, `/customers/${id}/membership`, {
    method: "POST",
    withJsonBody: true,
  });
}
