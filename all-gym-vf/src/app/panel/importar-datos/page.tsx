import { redirect } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { getUserAccessContext } from "@/lib/auth/authorization";
import { MigrationImport } from "@/features/migration/components/migration-import";

export const metadata = { title: "Panel: Importar datos" };
export default async function ImportDataPage() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) redirect("/iniciar-sesion");
  if (!access.isOwner) redirect("/panel");
  return <PageContainer scrollable pageTitle="Importar datos" pageDescription="Trae los datos de Hostinger a este equipo">
    <MigrationImport />
  </PageContainer>;
}
