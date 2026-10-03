import { NextRequest } from "next/server";
import { proxyCustomersRequest } from "../../../_lib";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyCustomersRequest(request, `/customers/${encodeURIComponent(id)}/membership/pending`, {
    method: "PATCH", withJsonBody: true,
  });
}
