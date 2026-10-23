"use client";

import { isExerciseVideoUrl } from "@/lib/training/exercise-media";

// Keep GIFs as images so their original animation is preserved.
export function ExerciseMedia({ src, alt, className, loading = "lazy", isVideo, controls = true, onError }: {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  isVideo?: boolean;
  controls?: boolean;
  onError?: () => void;
}) {
  if (isVideo ?? isExerciseVideoUrl(src)) {
    return <video key={src} src={src} aria-label={alt} className={className}
      controls={controls} autoPlay loop muted playsInline preload="metadata" onError={onError} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading={loading} onError={onError} />;
}
