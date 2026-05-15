"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { seedExerciseCatalog } from "@/features/customers/actions/customer-routine-actions";

export function SeedCatalogButton() {
  const router = useRouter();
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeed = async () => {
    try {
      setIsSeeding(true);
      const result = await seedExerciseCatalog();

      if (!result.success) {
        toast.error(result.errors[0] || result.message || "No se pudo importar el catálogo inicial.");
        return;
      }

      if (result.failedKeywords.length > 0) {
        toast.warning(
          `${result.message} Categorías con problema: ${result.failedKeywords.slice(0, 3).join(", ")}${result.failedKeywords.length > 3 ? "..." : ""}.`,
        );
      } else {
        toast.success(result.message);
      }

      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al sembrar el catálogo.");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Button
      onClick={handleSeed}
      disabled={isSeeding}
    >
      {isSeeding ? "Importando catálogo inicial..." : "Importar Catálogo Inicial"}
    </Button>
  );
}
