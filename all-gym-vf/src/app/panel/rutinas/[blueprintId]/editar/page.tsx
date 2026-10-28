import { notFound, redirect } from "next/navigation";

import PageContainer from "@/components/layout/page-container";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { getRoutineBlueprintDetail } from "@/features/routines/actions/blueprint-actions";
import { BlueprintCreateForm } from "@/features/routines/components/blueprint-create-form";

export const metadata = { title: "Panel: Editar plantilla" };

export default async function EditBlueprintPage({ params }: {
  params: Promise<{ blueprintId: string }>;
}) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) redirect("/iniciar-sesion");
  if (!hasPermission(access, "routines.view") || !hasPermission(access, "routines.manage_blueprints")) {
    redirect("/panel");
  }
  const { blueprintId } = await params;
  const data = await getRoutineBlueprintDetail(blueprintId).catch(() => null);
  if (!data) notFound();

  return (
    <PageContainer scrollable pageTitle="Editar plantilla"
      pageDescription="Modifica los días, ejercicios, series, repeticiones y descansos de esta plantilla.">
      <BlueprintCreateForm key={blueprintId} initialData={data} />
    </PageContainer>
  );
}
