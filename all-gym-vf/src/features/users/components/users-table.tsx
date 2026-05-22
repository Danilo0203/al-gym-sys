"use client";

import { setUserStatus, type UserData } from "../actions/user-actions";
import { DataTable } from "@/components/ui/table/data-table";
import { DataTableToolbar } from "@/components/ui/table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { UserFormSheet } from "./user-form-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconEdit, IconUserCheck, IconUserOff } from "@tabler/icons-react";
import { emitAdminRefresh } from "@/lib/admin-refresh";

interface UsersTableProps {
  data: UserData[];
  roleNameMap?: Record<string, string>;
  canUpdateUsers: boolean;
}

export function UsersTable({ data, roleNameMap = {}, canUpdateUsers }: UsersTableProps) {
  const canManageStatus = canUpdateUsers;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [userToToggle, setUserToToggle] = useState<UserData | null>(null);

  const handleToggleStatus = async () => {
    if (!userToToggle) return;

    try {
      const result =
        userToToggle.status === "active"
          ? await setUserStatus({ id: userToToggle.id, status: "disabled" })
          : await setUserStatus({ id: userToToggle.id, status: "active" });

      if (result.success) {
        toast.success(userToToggle.status === "active" ? "Usuario desactivado correctamente" : "Usuario activado correctamente");
        emitAdminRefresh("users");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Error al actualizar estado del usuario");
    } finally {
      setIsStatusOpen(false);
      setUserToToggle(null);
    }
  };

  const columns = useMemo<ColumnDef<UserData>[]>(
    () => [
      {
        id: "full_name",
        accessorKey: "full_name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="USUARIO" />,
        enableColumnFilter: true,
        meta: {
          label: "Buscar por nombre...",
          placeholder: "Buscar por nombre...",
          variant: "text" as const,
        },
        cell: ({ row }) => {
          const { full_name, email } = row.original;
          const initials = full_name
            ? full_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .substring(0, 2)
            : email.substring(0, 2).toUpperCase();

          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{full_name || "Sin nombre"}</span>
                <span className="text-xs text-muted-foreground">{email}</span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: ({ column }) => <DataTableColumnHeader column={column} title="ROL" />,
        enableColumnFilter: true,
        meta: {
          label: "Rol",
          variant: "multiSelect" as const,
          options: Object.entries(roleNameMap).map(([slug, name]) => ({
            label: name,
            value: slug,
          })),
        },
        cell: ({ row }) => {
          const role = (row.getValue("role") as string | null) ?? "client";
          const colorMap: Record<string, "default" | "secondary" | "destructive" | "outline" | "success"> = {
            owner: "default",
            admin: "destructive",
            trainer: "default",
            employee: "secondary",
            client: "outline",
          };
          return (
            <Badge variant={colorMap[role] || "outline"} className="capitalize">
              {roleNameMap[role] || role}
            </Badge>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="ESTADO" />,
        cell: ({ row }) => {
          const status = row.getValue("status") as UserData["status"];
          const labelMap: Record<UserData["status"], string> = {
            active: "Activo",
            disabled: "Desactivado",
            locked: "Bloqueado",
          };

          const variantMap: Record<UserData["status"], "success" | "secondary" | "outline"> = {
            active: "success",
            disabled: "secondary",
            locked: "outline",
          };

          return <Badge variant={variantMap[status]}>{labelMap[status]}</Badge>;
        },
      },
      {
        accessorKey: "created_at",
        header: ({ column }) => <DataTableColumnHeader column={column} title="FECHA DE CREACIÓN" />,
        cell: ({ row }) => {
          const date = new Date(row.getValue("created_at"));
          return <span className="text-sm text-muted-foreground">{format(date, "PPP", { locale: es })}</span>;
        },
      },
      {
        id: "actions",
        header: "ACCIONES",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center gap-1">
              {canUpdateUsers && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-muted"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsFormOpen(true);
                        }}
                      >
                        <IconEdit className="h-4 w-4 text-blue-500" />
                        <span className="sr-only">Editar</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Editar usuario</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {canManageStatus && user.status !== "locked" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={user.status === "active" ? "h-8 w-8 hover:bg-destructive/10" : "h-8 w-8 hover:bg-emerald-500/10"}
                        onClick={() => {
                          setUserToToggle(user);
                          setIsStatusOpen(true);
                        }}
                      >
                        {user.status === "active" ? (
                          <IconUserOff className="h-4 w-4 text-destructive" />
                        ) : (
                          <IconUserCheck className="h-4 w-4 text-emerald-600" />
                        )}
                        <span className="sr-only">{user.status === "active" ? "Desactivar" : "Activar"}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{user.status === "active" ? "Desactivar usuario" : "Activar usuario"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
      },
    ],
    [canManageStatus, canUpdateUsers, roleNameMap],
  );

  const { table } = useDataTable({
    data,
    columns,
    pageCount: 1,
    shallow: false,
  });

  return (
    <>
      <DataTable table={table}>
        <DataTableToolbar table={table} />
      </DataTable>

      <UserFormSheet open={isFormOpen} onOpenChange={setIsFormOpen} user={selectedUser} />

      <AlertDialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{userToToggle?.status === "active" ? "¿Desactivar usuario?" : "¿Activar usuario?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {userToToggle?.status === "active"
                ? "El usuario perderá acceso al sistema hasta que vuelva a activarse."
                : "El usuario recuperará acceso al sistema."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleStatus}
              className={
                userToToggle?.status === "active"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }
            >
              {userToToggle?.status === "active" ? "Desactivar" : "Activar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
