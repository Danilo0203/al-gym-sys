import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { getRoutineBlueprintDetail } from "@/features/routines/actions/blueprint-actions";
import { BlueprintDetailView } from "@/features/routines/components/blueprint-detail-view";

interface BlueprintDetailPageProps {
  params: Promise<{ blueprintId: string }>;
}

export const metadata = {
  title: "Panel: Detalle de plantilla",
};

export default async function BlueprintDetailPage({ params }: BlueprintDetailPageProps) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) redirect("/iniciar-sesion");
  if (!hasPermission(access, "routines.view")) redirect("/panel");

  const { blueprintId } = await params;

  const data = await getRoutineBlueprintDetail(blueprintId).catch(() => null);
  if (!data) notFound();

  return (
    <PageContainer
      scrollable
      pageTitle={data.blueprint.name}
      pageDescription="Vista detallada de la plantilla de rutina."
    >
      <Suspense>
        <BlueprintDetailView data={data} />
      </Suspense>
    </PageContainer>
  );
}
