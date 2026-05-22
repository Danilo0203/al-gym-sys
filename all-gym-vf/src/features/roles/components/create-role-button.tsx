"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { RoleFormSheet } from "./role-form-sheet";

interface CreateRoleButtonProps {
  canCreate: boolean;
}

export function CreateRoleButton({ canCreate }: CreateRoleButtonProps) {
  const [open, setOpen] = useState(false);

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
