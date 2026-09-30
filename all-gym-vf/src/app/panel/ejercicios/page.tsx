import PageContainer from "@/components/layout/page-container";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { ExerciseCatalogManager } from "@/features/exercises/components/exercise-catalog-manager";
import { getLocalExercises } from "@/features/exercises/server/local-exercises";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Ejercicios y Catálogo",
};

export default async function ExercisesPage() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect("/iniciar-sesion");
  }

  if (!hasPermission(access, "exercises.view")) {
    redirect("/panel");
  }

  const exercises = await getLocalExercises();

  return (
    <PageContainer>
      <div className="flex items-start justify-between">
        <Heading title="Ejercicios" description="Gestiona el catálogo local de ejercicios, imágenes y altas manuales." />
      </div>
      <Separator className="my-4" />
      <ExerciseCatalogManager exercises={exercises.data} totalCount={exercises.total} />
    </PageContainer>
  );
}
