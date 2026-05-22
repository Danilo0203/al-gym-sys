import PageContainer from "@/components/layout/page-container";
import UserListing from "@/features/users/components/user-listing";
import { Suspense } from "react";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { CreateUserButton } from "@/features/users/components/create-user-button";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { searchParamsCache } from "@/lib/searchparams";
import { redirect } from "next/navigation";
import { SearchParams } from "nuqs/server";

export const metadata = {
  title: "Panel: Usuarios",
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function UsersPage(props: PageProps) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect("/iniciar-sesion");
  }
  if (!hasPermission(access, "users.view")) {
    redirect("/panel");
  }

  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      scrollable={false}
      pageTitle="Usuarios"
      pageDescription="Administración de usuarios internos del sistema. Los clientes se gestionan desde Clientes."
      pageHeaderAction={hasPermission(access, "users.create") ? <CreateUserButton /> : null}
    >
      <Suspense fallback={<DataTableSkeleton columnCount={4} rowCount={8} />}>
        <UserListing />
      </Suspense>
    </PageContainer>
  );
}
