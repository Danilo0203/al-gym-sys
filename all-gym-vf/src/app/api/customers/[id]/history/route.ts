import { NextRequest } from "next/server";
import { customerHistoryResponseSchema } from "@/features/customers/lib/local-customers";
import { proxyValidatedCustomersGet } from "../../_lib";

const ALLOWED_QUERY_PARAMS = [
  "attendance_limit",
  "heatmap_days",
  "memberships_page",
  "memberships_page_size",
  "payments_page",
  "payments_page_size",
  "assessments_page",
  "assessments_page_size",
];

interface CustomerHistoryRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: CustomerHistoryRouteContext) {
  const { id } = await context.params;

  return proxyValidatedCustomersGet(
    request,
    `/customers/${id}/history`,
    customerHistoryResponseSchema,
    ALLOWED_QUERY_PARAMS,
  );
}
