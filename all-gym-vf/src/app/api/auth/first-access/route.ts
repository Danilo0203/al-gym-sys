import { type NextRequest } from "next/server";
import { proxyAuthRequest } from "@/lib/auth/auth-proxy";
import { authContextSchema, authFirstAccessRequestSchema } from "@/lib/auth/contracts";

export async function POST(request: NextRequest) {
  return proxyAuthRequest(request, {
    pathname: "/auth/first-access", method: "POST",
    requestSchema: authFirstAccessRequestSchema, responseSchema: authContextSchema,
  });
}
