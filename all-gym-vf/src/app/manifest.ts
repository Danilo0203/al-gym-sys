import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "All Gym",
    short_name: "All Gym",
    description: "Rutina, membresía y perfil del cliente de All Gym",
    start_url: "/mi/rutina",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#101826",
    theme_color: "#101826",
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/pwa/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
