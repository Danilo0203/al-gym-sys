import PageContainer from "@/components/layout/page-container";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { ExerciseCatalogManager } from "@/features/exercises/components/exercise-catalog-manager";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeExerciseCatalogItem } from "@/lib/training/catalog";
import { hydrateExerciseCatalogMedia } from "@/lib/training/exercise-media";
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

  const adminClient = createAdminClient();
  const { data, count } = await adminClient
    .from("exercises")
    .select(
      "id, slug, name, display_name, display_name_es, provider, body_parts, target_muscles, equipments, image_url, is_active, is_favorite, is_preview_hidden",
      { count: "exact" },
    )
    .eq("is_active", true)
    .order("display_name", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true, nullsFirst: false });

  const exercises = (data ?? []).map((row) => normalizeExerciseCatalogItem(row as Record<string, unknown>));
  const hydratedExercises = await hydrateExerciseCatalogMedia(exercises);

  return (
    <PageContainer>
      <div className="flex items-start justify-between">
        <Heading title="Ejercicios" description="Gestiona el catálogo local de ejercicios, imágenes y altas manuales." />
      </div>
      <Separator className="my-4" />
      <ExerciseCatalogManager exercises={hydratedExercises} totalCount={count ?? hydratedExercises.length} />
    </PageContainer>
  );
}
