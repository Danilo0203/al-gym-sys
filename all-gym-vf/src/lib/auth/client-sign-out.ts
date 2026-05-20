"use client";

import { clearPwaCaches } from "@/lib/pwa/client-cache";
import { logoutCurrentLocalUser } from "@/lib/auth/local-auth-client";

export async function signOutCurrentUser() {
  void clearPwaCaches().catch((error) => {
    console.warn("No fue posible limpiar los caches PWA durante el logout:", error);
  });

  await logoutCurrentLocalUser();
}
