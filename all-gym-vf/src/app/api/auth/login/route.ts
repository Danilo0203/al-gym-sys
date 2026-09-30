import { type NextRequest } from "next/server";

import { proxyAuthRequest } from "@/lib/auth/auth-proxy";
import { authContextSchema, authLoginRequestSchema } from "@/lib/auth/contracts";

export async function POST(request: NextRequest) {
  return proxyAuthRequest(request, {
    pathname: "/auth/login",
    method: "POST",
    requestSchema: authLoginRequestSchema,
    responseSchema: authContextSchema,
  });
}
