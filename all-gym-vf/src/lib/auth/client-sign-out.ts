"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clearPwaCaches } from "@/lib/pwa/client-cache";

export async function signOutCurrentUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase variables missing.");
  }

  void clearPwaCaches().catch((error) => {
    console.warn("No fue posible limpiar los caches PWA durante el logout:", error);
  });

  const supabase = createBrowserClient(supabaseUrl, supabaseKey);
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    throw error;
  }
}
