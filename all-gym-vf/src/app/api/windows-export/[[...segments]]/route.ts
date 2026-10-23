import { createHash } from "node:crypto";
import { createExportApi } from "@/lib/migration/export-api";
import { exportVault } from "@/lib/migration/export-vault";
import { requestExportService } from "@/lib/migration/export-transport";
import { getUserAccessContext } from "@/lib/auth/authorization";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handle = createExportApi({ vault: exportVault, remote: requestExportService, owner: async request => {
  const access = await getUserAccessContext();
  const localSession = request.cookies.get("algym_session")?.value;
  if (!access.isAuthenticated || !access.isOwner || !access.userId || !localSession) return null;
  return access.userId + ":" + createHash("sha256").update(localSession).digest("hex");
} });
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
