"use client";

import { useEffect, useState } from "react";
import { getRoles, type RoleData } from "../actions/role-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Pencil, Trash2, Shield, Users, Lock } from "lucide-react";
import { RoleFormSheet } from "./role-form-sheet";
import { DeleteRoleDialog } from "./delete-role-dialog";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";

export function RolesListing() {
  const { data: currentUser } = useCurrentUser();
  const canUpdateRoles = Boolean(currentUser?.isOwner || currentUser?.permissions?.includes("roles.update"));
  const canDeleteRoles = Boolean(currentUser?.isOwner || currentUser?.permissions?.includes("roles.delete"));
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<RoleData | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<RoleData | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchRoles = async (silent = false) => {
    if (!silent) setLoading(true);
    const result = await getRoles();
    if (result.success && result.data) {
      setRoles(result.data);
    } else {
      toast.error(result.error || "Error al cargar roles");
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRoles();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const panelRoles = roles.filter((r) => r.scope === "panel");

  return (
    <>
      <div className="space-y-2">
        {panelRoles.map((role) => (
          <Card key={role.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-sm truncate">{role.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">({role.slug})</span>
                  {role.is_protected && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Lock className="h-3 w-3" />
                      Protegido
                    </Badge>
                  )}
                  {role.is_system && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Shield className="h-3 w-3" />
                      Sistema
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-xs gap-1">
                  <Users className="h-3 w-3" />
                  {role.user_count ?? 0} usuarios
                </Badge>
                {!role.is_protected && (canUpdateRoles || canDeleteRoles) && (
                  <div className="flex items-center gap-1">
                    {canUpdateRoles && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingRole(role);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDeleteRoles && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingRole(role);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {panelRoles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No hay roles configurados
          </div>
        )}
      </div>
      <RoleFormSheet
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingRole(null);
        }}
        role={editingRole}
        onSuccess={() => void fetchRoles(true)}
      />
      <DeleteRoleDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeletingRole(null);
        }}
        role={deletingRole}
        roles={roles.filter((r) => r.id !== deletingRole?.id)}
        onSuccess={() => void fetchRoles(true)}
      />
    </>
  );
}
