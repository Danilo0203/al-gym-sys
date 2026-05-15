import { getUserAccessContext } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 40;

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export async function GET(request: Request) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !access.isAdmin) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() ?? "";
  const offset = parsePositiveInteger(url.searchParams.get("offset"), 0);
  const limit = Math.min(parsePositiveInteger(url.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);

  const adminClient = createAdminClient();
  let queryBuilder = adminClient
    .from("profiles")
    .select("id, full_name, avatar_url", { count: "exact" })
    .eq("role", "client")
    .eq("is_active", true)
    .order("full_name", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit);

  if (query) {
    queryBuilder = queryBuilder.ilike("full_name", `%${query}%`);
  }

  const { data, error, count } = await queryBuilder;

  if (error) {
    return Response.json({ error: error.message || "clients_unavailable" }, { status: 500 });
  }

  const rows = (data ?? []).slice(0, limit).map((row) => ({
    id: String(row.id),
    full_name: typeof row.full_name === "string" ? row.full_name : "Sin nombre",
    avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
  }));

  const hasMore = (count ?? rows.length) > offset + rows.length;

  return Response.json(
    {
      data: rows,
      nextOffset: hasMore ? offset + limit : null,
      total: count ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
