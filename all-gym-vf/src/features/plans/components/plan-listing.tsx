import { PlanTable } from "./plan-tables/plan-table";
import { searchParamsCache } from "@/lib/searchparams";
import { getPlansFromServer, Plan } from "@/features/customers/lib/local-memberships";

export default async function PlanListingPage() {
  const page = searchParamsCache.get("page");
  const perPage = searchParamsCache.get("perPage");
  const name = searchParamsCache.get("name");
  const is_active = searchParamsCache.get("is_active");

  const allPlans = await getPlansFromServer();
  let filteredPlans = [...allPlans];

  // Apply text filter
  if (name) {
    const lowerName = name.toLowerCase();
    filteredPlans = filteredPlans.filter((p) => p.name.toLowerCase().includes(lowerName));
  }

  // Apply is_active filter (multi-select)
  if (is_active) {
    const activeStates = is_active.split(",").filter(Boolean);
    if (activeStates.length > 0) {
      const boolStates = new Set(activeStates.map((s) => s === "true"));
      filteredPlans = filteredPlans.filter((p) => boolStates.has(p.is_active));
    }
  }

  // Sorting
  const sort = searchParamsCache.get("sort");
  const allowedSortColumns = new Set(["name", "price", "duration_days", "is_active", "id"]);
  if (sort && sort.length > 0) {
    const s = sort[0]; // Apply primary sort
    if (allowedSortColumns.has(s.id)) {
      filteredPlans.sort((a, b) => {
        const valA = a[s.id as keyof Plan];
        const valB = b[s.id as keyof Plan];
        
        if (valA == null && valB == null) return 0;
        if (valA == null) return s.desc ? -1 : 1;
        if (valB == null) return s.desc ? 1 : -1;
        
        if (valA < valB) return s.desc ? 1 : -1;
        if (valA > valB) return s.desc ? -1 : 1;
        return 0;
      });
    }
  } else {
    // default sort by id asc
    filteredPlans.sort((a, b) => a.id.localeCompare(b.id));
  }

  // Pagination
  const from = (page - 1) * perPage;
  const to = from + perPage;
  
  const count = filteredPlans.length;
  const paginatedPlans = filteredPlans.slice(from, to);

  return <PlanTable data={paginatedPlans} totalItems={count} />;
}
