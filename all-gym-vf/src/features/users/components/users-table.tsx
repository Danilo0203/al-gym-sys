"use client";

import { deleteUser, registerUserBiometric, type UserData } from "../actions/user-actions";
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
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconEdit, IconFingerprint, IconTrash } from "@tabler/icons-react";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";

interface UsersTableProps {
  data: UserData[];
  roleNameMap?: Record<string, string>;
}

export function UsersTable({ data, roleNameMap = {} }: UsersTableProps) {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const canUpdateUsers = Boolean(currentUser?.isOwner || currentUser?.permissions?.includes("users.update"));
  const canDeleteUsers = Boolean(currentUser?.isOwner || currentUser?.permissions?.includes("users.delete"));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [userForBiometric, setUserForBiometric] = useState<UserData | null>(null);
  const [isBiometricOpen, setIsBiometricOpen] = useState(false);
  const [isRegisteringBiometric, setIsRegisteringBiometric] = useState(false);

  const handleRegisterBiometric = async () => {
    if (!userForBiometric || isRegisteringBiometric) return;
    setIsRegisteringBiometric(true);
    try {
      const result = await registerUserBiometric(userForBiometric.id);
      if (!result.success) {
        toast.error(result.error ?? "No se pudo preparar la huella");
        return;
      }
      if (result.pending) {
        toast.warning(`Se asignó el número #${result.biometricId}. El reloj está pendiente de sincronización.`);
      } else {
        toast.success(`Número #${result.biometricId} preparado para el reloj. Registra la huella directamente en el dispositivo.`);
      }
      router.refresh();
      setIsBiometricOpen(false);
    } catch {
      toast.error("No se pudo preparar la huella");
    } finally {
      setIsRegisteringBiometric(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      const result = await deleteUser(userToDelete.id);
      if (result.success) {
        toast.success("Usuario eliminado correctamente");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Error al eliminar usuario");
    } finally {
      setIsDeleteOpen(false);
      setUserToDelete(null);
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
                <span className="font-medium text-sm">{full_name || "Sin nombre"}</span>
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
          const role = row.getValue("role") as string;
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
        accessorKey: "is_active",
        header: "ESTADO",
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? "success" : "secondary"}>
            {row.original.is_active ? "Activo" : "Inactivo"}
          </Badge>
        ),
      },
      {
        accessorKey: "biometric_id",
        header: "BIOMÉTRICO",
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.biometric_id == null ? "Sin registrar" : `#${row.original.biometric_id}`}</span>,
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
              {canUpdateUsers && user.is_active && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-muted"
                        onClick={() => { setUserForBiometric(user); setIsBiometricOpen(true); }}
                      >
                        <IconFingerprint className="h-4 w-4 text-emerald-500" />
                        <span className="sr-only">{user.biometric_id == null ? "Registrar huella" : "Sincronizar huella"}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{user.biometric_id == null ? "Registrar huella" : "Sincronizar huella"}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
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

              {canDeleteUsers && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10"
                        onClick={() => {
                          setUserToDelete(user);
                          setIsDeleteOpen(true);
                        }}
                      >
                        <IconTrash className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Eliminar usuario</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
      },
    ],
    [canDeleteUsers, canUpdateUsers, roleNameMap],
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

      <AlertDialog open={isBiometricOpen} onOpenChange={(open) => { if (!isRegisteringBiometric) setIsBiometricOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{userForBiometric?.biometric_id == null ? "Registrar huella de usuario" : "Sincronizar usuario con el reloj"}</AlertDialogTitle>
            <AlertDialogDescription>
              {userForBiometric?.full_name ?? userForBiometric?.email} podrá ingresar sin membresía. Se enviará su número biométrico al reloj.
              Después, coloca su dedo en el dispositivo para registrar la huella. No se requiere una ficha de cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegisteringBiometric}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isRegisteringBiometric} onClick={(event) => { event.preventDefault(); void handleRegisterBiometric(); }}>
              {isRegisteringBiometric ? "Preparando..." : "Enviar al reloj"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactivará la cuenta de <span className="font-bold">{userToDelete?.email}</span>
              {" "}y se cerrarán sus sesiones. Se conservará su historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
