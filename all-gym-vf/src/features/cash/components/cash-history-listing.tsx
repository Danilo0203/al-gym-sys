import { searchParamsCache } from "@/lib/searchparams";
import { getCashHistoryData } from "@/features/cash/actions/cash-actions";
import { CashModuleSetupState } from "@/features/cash/components/cash-module-setup-state";
import { CashHistoryTable } from "@/features/cash/components/cash-history-tables/cash-history-table";
import { isCashModuleNotReadyError } from "@/features/cash/lib/cash-module-errors";

function formatDateInGuatemala(timestamp: string | null | undefined) {
  if (!timestamp) return null;

  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp)) {
    return null;
  }

  const date = new Date(numericTimestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const dateParts = formatter.formatToParts(date);
  const year = dateParts.find((part) => part.type === "year")?.value;
  const month = dateParts.find((part) => part.type === "month")?.value;
  const day = dateParts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function parseDateRangeFilter(value: string | null) {
  if (!value) {
    return { dateFrom: null, dateTo: null };
  }

  const [fromTimestamp, toTimestamp] = value.split(",");

  return {
    dateFrom: formatDateInGuatemala(fromTimestamp),
    dateTo: formatDateInGuatemala(toTimestamp),
  };
}

export async function CashHistoryListingPage() {
  const page = searchParamsCache.get("page");
  const perPage = searchParamsCache.get("perPage");
  const sessionNumber = searchParamsCache.get("session_number");
  const openedAt = searchParamsCache.get("opened_at");
  const openedByUserId = searchParamsCache.get("opened_by_user_id");
  const status = searchParamsCache.get("status");
  const sort = searchParamsCache.get("sort");
  const { dateFrom, dateTo } = parseDateRangeFilter(openedAt);
  let data;

  try {
    data = await getCashHistoryData({
      page,
      perPage,
      sessionNumber: sessionNumber ?? null,
      dateFrom,
      dateTo,
      status: (status as "open" | "closed" | "closed_with_difference" | "cancelled" | "all" | null) || "all",
      openedByUserId: openedByUserId ?? null,
      sort,
    });
  } catch (error) {
    if (!isCashModuleNotReadyError(error)) {
      throw error;
    }

    return <CashModuleSetupState title="Historial de caja pendiente de inicializacion" />;
  }

  return (
    <CashHistoryTable
      data={data.sessions}
      totalItems={data.totalItems}
      userOptions={data.availableUsers.map((user) => ({
        label: user.name,
        value: user.id,
      }))}
    />
  );
}
