import { type NextRequest } from "next/server";
import { proxyLocalAuthRequest } from "@/lib/auth/local-auth-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return proxyLocalAuthRequest(request, "/auth/logout");
}
