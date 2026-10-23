import { redirect } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { getUserAccessContext } from "@/lib/auth/authorization";
import { HostingerExport } from "@/features/migration/components/hostinger-export";
export const metadata = { title: "Panel: Exportar para Windows" };
export default async function ExportPage() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) redirect("/iniciar-sesion");
  if (!access.isOwner) redirect("/panel");
  return <PageContainer scrollable pageTitle="Exportar para Windows" pageDescription="Descarga una copia actualizada de Hostinger">
    <HostingerExport />
  </PageContainer>;
}
