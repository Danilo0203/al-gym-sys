import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { normalizeCustomerSearchText } from "@/lib/customers/search";
import { serverGetCustomersList } from "@/features/customers/lib/customer-server-api";

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

  try {
    const result = await serverGetCustomersList({
      page: 1,
      pageSize: limit,
      search: normalizedQuery,
      sort: "full_name",
    });

    const rows = result.data.map((row) => ({
      id: row.id,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      plan_name: row.current_membership?.plan_name ?? null,
      subscription_status: row.current_membership?.status ?? null,
      is_active: row.is_active,
    }));

    return Response.json(
      { data: rows },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "clients_unavailable",
      },
      { status: 500 },
    );
  }
}
