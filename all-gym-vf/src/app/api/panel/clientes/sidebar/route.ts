import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCustomerSearchText } from "@/lib/customers/search";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export async function GET(request: Request) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !hasPermission(access, "customers.view")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() ?? "";
  const normalizedQuery = normalizeCustomerSearchText(query);
  const limit = Math.min(parsePositiveInteger(url.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);

  const adminClient = createAdminClient();
  let queryBuilder = adminClient
    .from("customer_overview")
    .select("id, full_name, avatar_url, plan_name, subscription_status, is_active")
    .eq("role", "client")
    .order("full_name", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (normalizedQuery) {
    queryBuilder = queryBuilder.ilike("full_name_search", `%${normalizedQuery}%`);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    return Response.json({ error: error.message || "clients_unavailable" }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => ({
    id: String(row.id),
    full_name: typeof row.full_name === "string" ? row.full_name : "Sin nombre",
    avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
    plan_name: typeof row.plan_name === "string" ? row.plan_name : null,
    subscription_status: typeof row.subscription_status === "string" ? row.subscription_status : null,
    is_active: typeof row.is_active === "boolean" ? row.is_active : null,
  }));

  return Response.json(
    { data: rows },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
