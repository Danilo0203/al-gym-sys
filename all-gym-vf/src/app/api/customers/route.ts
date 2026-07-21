import { NextRequest } from "next/server";
import { proxyCustomersRequest } from "./_lib";

const ALLOWED_QUERY_PARAMS = ["page", "page_size", "search", "sort"];

export async function GET(request: NextRequest) {
  return proxyCustomersRequest(request, "/customers", {
    method: "GET",
    allowedSearchParams: ALLOWED_QUERY_PARAMS,
  });
}

export async function POST(request: NextRequest) {
  return proxyCustomersRequest(request, "/customers", {
    method: "POST",
    withJsonBody: true,
  });
}
