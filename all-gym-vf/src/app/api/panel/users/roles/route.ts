import { type NextRequest } from "next/server";
import { proxyLocalApiRequest } from "@/lib/api/local-proxy";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return proxyLocalApiRequest(request, "/admin/users/roles");
}
