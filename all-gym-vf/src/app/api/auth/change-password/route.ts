import { type NextRequest } from "next/server";

import { proxyAuthRequest } from "@/lib/auth/auth-proxy";
import {
  authChangePasswordRequestSchema,
  authChangePasswordResponseSchema,
} from "@/lib/auth/contracts";

export async function POST(request: NextRequest) {
  return proxyAuthRequest(request, {
    pathname: "/auth/change-password",
    method: "POST",
    requestSchema: authChangePasswordRequestSchema,
    responseSchema: authChangePasswordResponseSchema,
  });
}
