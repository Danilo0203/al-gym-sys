"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { RoleFormSheet } from "./role-form-sheet";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";

export function CreateRoleButton() {
  const [open, setOpen] = useState(false);
  const { data: user } = useCurrentUser();
  const canCreate = Boolean(user?.isOwner || user?.permissions?.includes("roles.create"));

  if (!canCreate) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="mr-2 h-4 w-4" />
        Nuevo rol
      </Button>
      <RoleFormSheet
        open={open}
        onOpenChange={setOpen}
        role={null}
        onSuccess={() => setOpen(false)}
      />
    </>
  );
}
