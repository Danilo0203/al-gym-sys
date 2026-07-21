import { NextRequest } from "next/server";
import { proxyCustomersRequest } from "../../_lib";

interface CustomerHistoryRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: CustomerHistoryRouteContext,
) {
  const { id } = await context.params;

  return proxyCustomersRequest(request, `/customers/${id}/history`, {
    method: "GET",
  });
}
