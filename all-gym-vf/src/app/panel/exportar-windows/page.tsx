import { redirect } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { getExportOwner } from "@/lib/migration/owner";
import { WindowsExport } from "@/features/migration/windows-export";
export const metadata = { title: "Panel: Exportar para Windows" };
export default async function ExportPage() {
  if (!(await getExportOwner())) redirect("/panel");
  return <PageContainer scrollable pageTitle="Exportar para Windows" pageDescription="Descarga una copia actual de los datos de tu gimnasio."><WindowsExport /></PageContainer>;
}
