import { type NextRequest } from "next/server";
import { proxyLocalApiRequest } from "@/lib/api/local-proxy";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyLocalApiRequest(request, `/admin/users/${id}/role`);
}
