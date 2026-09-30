import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { serverGetCustomersList } from "@/features/customers/lib/customer-server-api";

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
  if (!access.isAuthenticated || !hasPermission(access, "customers.view")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() ?? "";
  const offset = parsePositiveInteger(url.searchParams.get("offset"), 0);
  const limit = Math.min(parsePositiveInteger(url.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
  const page = Math.floor(offset / limit) + 1;

  try {
    const result = await serverGetCustomersList({
      page,
      pageSize: limit,
      search: query,
      sort: "full_name",
      isActive: true,
    });

    const rows = result.data.map((row) => ({
      id: row.id,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
    }));

    const total = result.meta.total;
    const hasMore = total > offset + rows.length;

    return Response.json(
      {
        data: rows,
        nextOffset: hasMore ? offset + limit : null,
        total,
      },
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
