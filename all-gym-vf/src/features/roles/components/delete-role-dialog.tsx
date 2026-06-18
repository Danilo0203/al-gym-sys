"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteRole, type RoleData } from "../actions/role-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { profileKeys } from "@/features/profile/hooks/use-profile";

interface DeleteRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleData | null;
  roles: RoleData[];
  onSuccess: () => void;
}

export function DeleteRoleDialog({ open, onOpenChange, role, roles, onSuccess }: DeleteRoleDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [replacementSlug, setReplacementSlug] = useState("");
  const [needsReassign, setNeedsReassign] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const panelRoles = roles.filter((r) => r.scope === "panel" && !r.is_protected);

  const handleDelete = async () => {
    if (!role) return;
    setSubmitting(true);
    try {
      const result = await deleteRole({
        id: role.id,
        replacementRoleSlug: needsReassign ? replacementSlug : undefined,
      });
      if (result.success) {
        await queryClient.invalidateQueries({ queryKey: profileKeys.current() });
        router.refresh();
        toast.success("Rol eliminado correctamente");
        onSuccess();
        onOpenChange(false);
      } else if (result.error === "REASSIGN_REQUIRED") {
        setNeedsReassign(true);
      } else {
        toast.error(result.error || "Error al eliminar rol");
      }
    } catch {
      toast.error("Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setNeedsReassign(false);
      setReplacementSlug("");
    }
    onOpenChange(open);
  };

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar rol</DialogTitle>
          <DialogDescription>
            {needsReassign
              ? `El rol "${role.name}" tiene ${role.user_count ?? 0} usuarios asignados. Selecciona un rol de reemplazo.`
              : `¿Estás seguro de eliminar el rol "${role.name}"?`}
          </DialogDescription>
        </DialogHeader>

        {needsReassign && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Rol de reemplazo</label>
            <Select value={replacementSlug} onValueChange={setReplacementSlug}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {panelRoles.map((r) => (
                  <SelectItem key={r.id} value={r.slug}>
                    {r.name} ({r.user_count ?? 0} usuarios)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={submitting || (needsReassign && !replacementSlug)}
          >
            {submitting ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
