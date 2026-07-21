import { NextRequest } from "next/server";
import { fetchAuthBackend } from "@/lib/auth/backend-auth";
import { parseCustomerListResponse, parseCustomerApiResponse } from "@/features/customers/lib/local-customers";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 40;

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() ?? "";
  const offset = parsePositiveInteger(url.searchParams.get("offset"), 0);
  const limit = Math.min(parsePositiveInteger(url.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);

  const page = Math.floor(offset / limit) + 1;
  const searchParams = new URLSearchParams({
    page: String(page),
    page_size: String(limit),
    sort: "full_name",
    is_active: "true",
  });

  if (query) searchParams.set("search", query);

  const upstreamResponse = await fetchAuthBackend(`/customers?${searchParams.toString()}`, {
    method: "GET",
    headers: request.headers.get("cookie") ? { cookie: request.headers.get("cookie")! } : undefined,
    cache: "no-store",
  });

  let customers;
  try {
    customers = await parseCustomerApiResponse(upstreamResponse, parseCustomerListResponse);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "clients_unavailable" },
      { status: upstreamResponse.ok ? 502 : upstreamResponse.status },
    );
  }

  const rows = customers.data.map(({ id, full_name, avatar_url }) => ({ id, full_name, avatar_url }));
  const hasMore = customers.meta.total > offset + rows.length;

  return Response.json(
    {
      data: rows,
      nextOffset: hasMore ? offset + limit : null,
      total: customers.meta.total,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
