import { NextRequest } from "next/server";
import { customerListResponseSchema } from "@/features/customers/lib/local-customers";
import { proxyCustomersRequest, proxyValidatedCustomersGet } from "./_lib";

const ALLOWED_QUERY_PARAMS = [
  "page",
  "page_size",
  "search",
  "sort",
  "is_active",
  "plan_id",
  "membership_status",
];

export async function GET(request: NextRequest) {
  return proxyValidatedCustomersGet(
    request,
    "/customers",
    customerListResponseSchema,
    ALLOWED_QUERY_PARAMS,
  );
}

export async function POST(request: NextRequest) {
  return proxyCustomersRequest(request, "/customers", {
    method: "POST",
    withJsonBody: true,
  });
}
