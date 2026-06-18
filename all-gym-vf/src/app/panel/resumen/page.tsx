import DashboardView from "@/features/overview/components/panel-view";
import { DashboardDateRange } from "@/features/overview/actions/panel-actions";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";
import { SearchParams } from "nuqs/server";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, startOfYear, endOfYear, format } from "date-fns";

export const metadata = {
  title: "Panel: Estado del negocio",
};

type pageProps = {
  searchParams: Promise<SearchParams>;
};

function getDateRangeFromPeriod(period?: string, from?: string, to?: string): DashboardDateRange {
  const now = new Date();

  if (period === "custom" && from && to) {
    return { from, to };
  }

  switch (period) {
    case "week":
      return {
        from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        to: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    case "last_month":
      return {
        from: format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
        to: format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
      };
    case "year":
      return {
        from: format(startOfYear(now), "yyyy-MM-dd"),
        to: format(endOfYear(now), "yyyy-MM-dd"),
      };
    case "month":
    default:
      return {
        from: format(startOfMonth(now), "yyyy-MM-dd"),
        to: format(endOfMonth(now), "yyyy-MM-dd"),
      };
  }
}

export default async function OverviewPage(props: pageProps) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect("/iniciar-sesion");
  }
  if (!hasPermission(access, "dashboard.view")) {
    redirect("/panel");
  }

  const searchParams = await props.searchParams;
  const period = (searchParams.period as string) || "month";
  const from = (searchParams.from as string) || undefined;
  const to = (searchParams.to as string) || undefined;

  const dateRange = getDateRangeFromPeriod(period, from, to);

  // We no longer await the data fetching here.
  // Instead, we pass variables that trigger fetching inside the nested Suspense components.
  // This allows the page shell to render immediately while components stream in.

  return <DashboardView period={period} dateRange={dateRange} />;
}
