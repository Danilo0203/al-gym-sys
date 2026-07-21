"use client";

import { useState } from "react";
import { IconLogout } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signOutCurrentUser } from "@/lib/auth/client-sign-out";

export function ClientSignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);

    try {
      await signOutCurrentUser();
    } catch (error) {
      console.error("Error signing out client app:", error);
      toast.error("No fue posible cerrar la sesión.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleSignOut}
      disabled={isSigningOut}
      aria-label="Cerrar sesión"
    >
      <IconLogout className="h-4 w-4" />
    </Button>
  );
}
