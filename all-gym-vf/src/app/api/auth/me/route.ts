import { type NextRequest } from "next/server";

import { proxyAuthRequest } from "@/lib/auth/auth-proxy";
import { authContextSchema } from "@/lib/auth/contracts";

export async function GET(request: NextRequest) {
  return proxyAuthRequest(request, {
    pathname: "/auth/me",
    method: "GET",
    responseSchema: authContextSchema,
  });
}
