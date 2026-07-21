import { NextRequest } from "next/server";
import { proxyCustomersRequest } from "../../../../../_lib";

interface RouteContext {
  params: Promise<{ id: string; routineId: string; detailId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, routineId, detailId } = await context.params;
  return proxyCustomersRequest(
    request,
    `/customers/${id}/routines/${routineId}/details/${detailId}`,
    { method: "PATCH", withJsonBody: true },
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id, routineId, detailId } = await context.params;
  return proxyCustomersRequest(
    request,
    `/customers/${id}/routines/${routineId}/details/${detailId}`,
    { method: "DELETE" },
  );
}
