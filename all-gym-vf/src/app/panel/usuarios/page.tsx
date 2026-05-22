import PageContainer from "@/components/layout/page-container";
import UserListing from "@/features/users/components/user-listing";
import { Suspense } from "react";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { CreateUserButton } from "@/features/users/components/create-user-button";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Panel: Usuarios",
};

export default async function UsersPage() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect("/iniciar-sesion");
  }
  if (!hasPermission(access, "users.view")) {
    redirect("/panel");
  }

  const canCreateUsers = hasPermission(access, "users.create");
  const canUpdateUsers = hasPermission(access, "users.update");

  return (
    <PageContainer
      scrollable={false}
      pageTitle="Usuarios"
      pageDescription="Administración de usuarios del sistema"
      pageHeaderAction={canCreateUsers ? <CreateUserButton canCreate={canCreateUsers} /> : null}
    >
      <Suspense fallback={<DataTableSkeleton columnCount={4} rowCount={8} />}>
        <UserListing canUpdateUsers={canUpdateUsers} />
      </Suspense>
    </PageContainer>
  );
}
