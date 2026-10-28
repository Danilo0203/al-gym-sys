import { type NextRequest } from "next/server";
import { proxyAuthRequest } from "@/lib/auth/auth-proxy";
import { authPhoneAccessRequestSchema, authPhoneAccessResponseSchema } from "@/lib/auth/contracts";

export async function POST(request: NextRequest) {
  return proxyAuthRequest(request, {
    pathname: "/auth/phone-access", method: "POST",
    requestSchema: authPhoneAccessRequestSchema, responseSchema: authPhoneAccessResponseSchema,
  });
}
