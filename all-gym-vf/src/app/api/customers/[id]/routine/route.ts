import { NextRequest } from "next/server";
import { proxyCustomersRequest } from "../../_lib";

interface CustomerRoutineRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: CustomerRoutineRouteContext,
) {
  const { id } = await context.params;

  return proxyCustomersRequest(request, `/customers/${id}/routine`, {
    method: "GET",
  });
}
