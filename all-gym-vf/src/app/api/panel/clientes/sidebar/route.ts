import { NextRequest } from "next/server";
import { fetchAuthBackend } from "@/lib/auth/backend-auth";
import { parseCustomerApiResponse, parseCustomerListResponse } from "@/features/customers/lib/local-customers";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() ?? "";
  const limit = Math.min(parsePositiveInteger(url.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
  const searchParams = new URLSearchParams({
    page: "1",
    page_size: String(limit),
    sort: "full_name",
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

  const rows = customers.data.map((customer) => ({
    id: customer.id,
    full_name: customer.full_name,
    avatar_url: customer.avatar_url,
    plan_name: customer.current_membership?.plan_name ?? null,
    subscription_status: customer.current_membership?.status ?? null,
    is_active: customer.is_active,
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
