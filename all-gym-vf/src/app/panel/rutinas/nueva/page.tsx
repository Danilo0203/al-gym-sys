import { redirect } from "next/navigation";

import PageContainer from "@/components/layout/page-container";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { BlueprintCreateForm } from "@/features/routines/components/blueprint-create-form";

export const metadata = {
  title: "Panel: Nueva plantilla",
};

export default async function NewBlueprintPage() {
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
      pageTitle="Nueva plantilla personalizada"
      pageDescription="Crea una plantilla de rutina desde cero. Define el objetivo, estructura los días y selecciona los ejercicios."
    >
      <BlueprintCreateForm />
    </PageContainer>
  );
}
