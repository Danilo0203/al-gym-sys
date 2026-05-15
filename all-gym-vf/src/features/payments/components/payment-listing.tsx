import { getPayments } from "@/features/payments/actions/get-payments";
import { PaymentTable } from "./payment-tables/payment-table";
import { MethodOption } from "./payment-tables/columns";
import { searchParamsCache } from "@/lib/searchparams";

export default async function PaymentListingPage() {
  const page = searchParamsCache.get("page");
  const perPage = searchParamsCache.get("perPage");
  const user_name = searchParamsCache.get("user_name");
  const method = searchParamsCache.get("method");
  const payment_date = searchParamsCache.get("payment_date");
  const subscription_status = searchParamsCache.get("subscription_status");
  const sort = searchParamsCache.get("sort");

  const filters = {
    page,
    perPage,
    user_name: user_name ?? undefined,
    method: method ?? undefined,
    payment_date: payment_date ?? undefined,
    subscription_status: subscription_status ?? undefined,
    sort: sort,
  };

  let data: import("./payment-tables/columns").Payment[] = [];
  let totalItems = 0;
  let errorMsg = null;

  try {
    const result = await getPayments(filters);
    data = result.data;
    totalItems = result.total;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Error desconocido";
  }

  const methodOptions: MethodOption[] = [
    { label: "Efectivo", value: "cash" },
    { label: "Tarjeta", value: "card" },
    { label: "Transferencia", value: "transfer" },
  ];

  if (errorMsg) {
    return (
      <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg text-destructive">
        Error al cargar pagos: {errorMsg}
      </div>
    );
  }

  return <PaymentTable data={data} totalItems={totalItems} methodOptions={methodOptions} />;
}
