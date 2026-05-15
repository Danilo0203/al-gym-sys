"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { UserFormSheet } from "./user-form-sheet";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";

export function CreateUserButton() {
  const [open, setOpen] = useState(false);
  const { data: user } = useCurrentUser();
  const canCreate = Boolean(user?.isOwner || user?.permissions?.includes("users.create"));

  if (!canCreate) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
        <Plus className="mr-2 h-4 w-4" /> Nuevo Usuario
      </Button>
      <UserFormSheet open={open} onOpenChange={setOpen} user={null} />
    </>
  );
}
