"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageFormSheet } from "./message-form-sheet";
import { Plus } from "lucide-react";

export function CreateMessageButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        Nuevo mensaje
      </Button>
      <MessageFormSheet
        open={open}
        onOpenChange={setOpen}
        template={null}
        onSuccess={() => {
          // Handled by parent via page refresh (revalidatePath)
        }}
      />
    </>
  );
}
