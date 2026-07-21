import { NextRequest } from "next/server";
import { customerSidebarResponseSchema } from "@/features/customers/lib/local-customers";
import { proxyValidatedCustomersGet } from "../_lib";

const ALLOWED_QUERY_PARAMS = ["search", "limit"];

export async function GET(request: NextRequest) {
  return proxyValidatedCustomersGet(
    request,
    "/customers/sidebar",
    customerSidebarResponseSchema,
    ALLOWED_QUERY_PARAMS,
  );
}
