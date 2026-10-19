"use client";

import { logoutFromLocalAuth } from "@/lib/auth/client-auth";
import { clearPwaCaches } from "@/lib/pwa/client-cache";

export async function signOutCurrentUser() {
  void clearPwaCaches().catch((error) => {
    console.warn("No fue posible limpiar los caches PWA durante el logout:", error);
  });

  await logoutFromLocalAuth();
  window.location.replace("/iniciar-sesion");
}
