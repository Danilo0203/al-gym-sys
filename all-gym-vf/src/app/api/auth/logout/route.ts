import { type NextRequest } from "next/server";

import { proxyAuthRequest } from "@/lib/auth/auth-proxy";

export async function POST(request: NextRequest) {
  return proxyAuthRequest(request, {
    pathname: "/auth/logout",
    method: "POST",
    allowNoContent: true,
  });
}
