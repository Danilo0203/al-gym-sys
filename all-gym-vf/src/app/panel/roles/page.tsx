import PageContainer from "@/components/layout/page-container";
import { Suspense } from "react";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";
import { RolesListing } from "@/features/roles/components/roles-listing";
import { CreateRoleButton } from "@/features/roles/components/create-role-button";

export const metadata = {
  title: "Panel: Roles",
};

export default async function RolesPage() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) redirect("/iniciar-sesion");
  if (!hasPermission(access, "roles.view")) redirect("/panel");

  const canCreateRoles = hasPermission(access, "roles.create");
  const canUpdateRoles = hasPermission(access, "roles.update");
  const canDeleteRoles = hasPermission(access, "roles.delete");

  return (
    <PageContainer
      scrollable={false}
      pageTitle="Roles"
      pageDescription="Administración de roles internos y sus permisos"
      pageHeaderAction={canCreateRoles ? <CreateRoleButton canCreate={canCreateRoles} /> : null}
    >
      <Suspense fallback={<DataTableSkeleton columnCount={4} rowCount={5} />}>
        <RolesListing canUpdateRoles={canUpdateRoles} canDeleteRoles={canDeleteRoles} />
      </Suspense>
    </PageContainer>
  );
}
