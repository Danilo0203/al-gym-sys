"use client";

import { ColumnDef } from "@tanstack/react-table";
import { UserData } from "../actions/user-actions";
import { Badge } from "@/components/ui/badge";
import { UserRole } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MoreHorizontal, SquarePen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type User = UserData;

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "full_name",
    header: "Nombre",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          <span className="font-medium">{row.getValue("full_name") || "Sin nombre"}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "email",
    header: "Correo electrónico",
  },
  {
    accessorKey: "role",
    header: "Rol",
    cell: ({ row }) => {
      const role = row.getValue("role") as UserRole;

      const roleMap: Record<UserRole, string> = {
        owner: "Propietario",
        admin: "Administrador",
        trainer: "Entrenador",
        employee: "Empleado",
        client: "Cliente",
      };

      const colorMap: Record<UserRole, "default" | "secondary" | "destructive" | "outline"> = {
        owner: "default",
        admin: "destructive",
        trainer: "default",
        employee: "secondary",
        client: "outline",
      };

      return <Badge variant={colorMap[role] || "outline"}>{roleMap[role] || role}</Badge>;
    },
  },
  {
    accessorKey: "created_at",
    header: "Fecha de creación",
    cell: ({ row }) => {
      const date = new Date(row.getValue("created_at"));
      return <span>{format(date, "PPP", { locale: es })}</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menú</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.id)}>Copiar ID</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              {/* This will trigger the edit form - needs to be handled via prop or context eventually, 
                   but for now we'll rely on the parent component passing handlers if we were clearer,
                   or just use a SheetTrigger directly if we had access to it here. 
                   Actually simpler: The parent DataTable can handle row actions or we expose a custom cell renderer
                   that accepts callbacks? 
                   Alternatively, we export the Cell component and use it in the parent.
                   For now, let's keep it simple standard shadcn table style.
               */}
              <span className="flex items-center w-full">
                <SquarePen className="mr-2 h-4 w-4" /> Editar
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
              <span className="flex items-center w-full">
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
