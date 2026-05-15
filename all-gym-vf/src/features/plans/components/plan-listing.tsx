import { createClient } from "@/lib/supabase/server";
import { PlanTable } from "./plan-tables/plan-table";
import { searchParamsCache } from "@/lib/searchparams";

export default async function PlanListingPage() {
  const page = searchParamsCache.get("page");
  const perPage = searchParamsCache.get("perPage");
  const name = searchParamsCache.get("name");
  const is_active = searchParamsCache.get("is_active");

  const supabase = await createClient();

  // Query plans with filtering
  let query = supabase.from("plans").select("*", { count: "exact" });

  // Apply text filter
  if (name) {
    query = query.ilike("name", `%${name}%`);
  }

  // Apply is_active filter (multi-select)
  if (is_active) {
    const activeStates = is_active.split(",").filter(Boolean);
    if (activeStates.length > 0) {
      // Convert string values to booleans
      const boolStates = activeStates.map((s) => s === "true");
      query = query.in("is_active", boolStates);
    }
  }

  // Pagination
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Sorting
  const sort = searchParamsCache.get("sort");
  const allowedSortColumns = new Set(["name", "price", "duration_days", "is_active", "id"]);
  let hasAppliedSort = false;
  if (sort && sort.length > 0) {
    sort.forEach((s) => {
      if (allowedSortColumns.has(s.id)) {
        query = query.order(s.id, { ascending: !s.desc, nullsFirst: false });
        hasAppliedSort = true;
      }
    });
  }

  if (!hasAppliedSort) {
    query = query.order("id", { ascending: true });
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching plans:", JSON.stringify(error, null, 2));
    return (
      <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg text-destructive">
        Error al cargar planes: {error.message}
      </div>
    );
  }

  const plans = data || [];

  return <PlanTable data={plans} totalItems={count || 0} />;
}
