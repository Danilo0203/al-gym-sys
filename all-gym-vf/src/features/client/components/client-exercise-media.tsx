"use client";

import { useState } from "react";
import { IconBarbell, IconPlayerPlay } from "@tabler/icons-react";
import { ExerciseMedia } from "@/features/exercises/components/exercise-media";
import { isExerciseMediaStoredLocally, isExerciseVideoUrl } from "@/lib/training/exercise-media";
import { cn } from "@/lib/utils";

export function ClientExerciseMedia({ src, name, thumbnail = false }: {
  src: string | null;
  name: string;
  thumbnail?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const available = isExerciseMediaStoredLocally(src) && failedUrl !== src;

  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-muted/50",
      thumbnail ? "size-16 shrink-0 rounded-xl" : "min-h-40 rounded-xl border border-border/60")}>
      {available ? (
        <>
          <ExerciseMedia
            src={src}
            alt={thumbnail ? "" : `Demostración de ${name}`}
            controls={!thumbnail}
            autoPlay={!thumbnail}
            loading={thumbnail ? "lazy" : "eager"}
            className={thumbnail ? "pointer-events-none size-full object-contain" : "max-h-[40dvh] w-full object-contain"}
            onError={() => setFailedUrl(src)}
          />
          {thumbnail && isExerciseVideoUrl(src) ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/20" aria-hidden="true">
              <span className="flex size-8 items-center justify-center rounded-full bg-background/95 text-primary shadow-sm"><IconPlayerPlay className="size-4" /></span>
            </span>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 p-3 text-center text-muted-foreground">
          <IconBarbell className="size-6" aria-hidden="true" />
          {!thumbnail ? <p className="max-w-xs text-sm">{src ? "No se pudo cargar la demostración. Revisa tu conexión e inténtalo de nuevo." : "Este ejercicio aún no tiene demostración. Consulta a tu entrenador."}</p> : null}
        </div>
      )}
    </div>
  );
}
