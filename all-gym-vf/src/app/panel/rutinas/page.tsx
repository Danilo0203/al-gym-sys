import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";

import PageContainer from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import RoutinesListing from "@/features/routines/components/routines-listing";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";

export const metadata = {
  title: "Panel: Rutinas",
};

export default async function RoutinesPage() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect("/iniciar-sesion");
  }
  if (!hasPermission(access, "routines.view")) {
    redirect("/panel");
  }

  return (
    <PageContainer
      scrollable
      pageTitle="Rutinas"
      pageDescription="Biblioteca de plantillas de rutina. Asigna a tus clientes."
      pageHeaderAction={
        <Button asChild>
          <Link href="/panel/rutinas/nueva">
            <IconPlus className="size-4" />
            Crear plantilla personalizada
          </Link>
        </Button>
      }
    >
      <Suspense fallback={<DataTableSkeleton columnCount={4} rowCount={8} />}>
        <RoutinesListing />
      </Suspense>
    </PageContainer>
  );
}
