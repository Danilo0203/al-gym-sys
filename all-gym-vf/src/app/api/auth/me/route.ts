import { type NextRequest } from "next/server";
import { proxyLocalAuthRequest } from "@/lib/auth/local-auth-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyLocalAuthRequest(request, "/auth/me");
}
