"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { useCustomersList } from "@/features/customers/hooks/use-customers";
import { CustomerTable } from "./customer-tables/customer-table";

interface CustomerListingClientProps {
  query: string;
  canUpdate: boolean;
}

export function CustomerListingClient({ query, canUpdate }: CustomerListingClientProps) {
  const customersQuery = useCustomersList(new URLSearchParams(query));

  if (customersQuery.isPending) {
    return <DataTableSkeleton columnCount={9} rowCount={8} filterCount={4} />;
  }

  if (customersQuery.isError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex min-h-48 flex-col items-center justify-center gap-4 text-center">
          <div>
            <p className="font-semibold">No se pudo cargar el listado de clientes</p>
            <p className="text-sm text-muted-foreground">{customersQuery.error.message}</p>
          </div>
          <Button variant="outline" onClick={() => customersQuery.refetch()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <CustomerTable
      data={customersQuery.data.data.map((customer) => ({
        ...customer,
        plan_id: customer.current_membership?.plan_id ?? null,
        plan_name: customer.current_membership?.plan_name ?? null,
        subscription_status: customer.current_membership?.status ?? null,
        subscription_start_date: customer.current_membership?.start_date ?? null,
        subscription_end_date: customer.current_membership?.end_date ?? null,
        subscription_grace_days: customer.current_membership?.grace_days ?? null,
        subscription_access_until: customer.current_membership?.access_until ?? null,
        subscription_display_status: customer.membership_status,
      }))}
      totalItems={customersQuery.data.meta.total}
      canUpdate={canUpdate}
    />
  );
}
