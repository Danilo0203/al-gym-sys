"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ColumnDef } from "@tanstack/react-table";
import { IconBrandWhatsapp } from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CustomerWhatsAppDialog } from "./customer-whatsapp-dialog";
import { CellAction } from "./cell-action";

function WhatsAppCell({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(true);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-600"
              title="Mandar mensaje"
            >
              <IconBrandWhatsapp className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Mandar mensaje</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <CustomerWhatsAppDialog open={open} onOpenChange={setOpen} customer={customer} />
    </>
  );
}

export type Customer = {
  id: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  email: string | null;
  birth_date: string;
  gender: "male" | "female" | "other";
  injuries?: string | null;
  medical_notes?: string | null;
  role?: "client";
  current_membership?: unknown | null;
  subscription_status?: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  subscription_grace_days?: number | null;
  subscription_access_until?: string | null;
  subscription_display_status?: string | null;
  plan_name?: string | null;
  last_check_in: string | null;
  biometric_id?: number | null;
};

interface CustomerColumnsOptions {
  fullNameColumnSize?: number;
  canUpdate?: boolean;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: value,
      time: null as string | null,
    };
  }

  return {
    date: format(date, "dd/MM/yyyy", { locale: es }),
    time: format(date, "HH:mm 'hs'", { locale: es }),
  };
}

export function getColumns(options: CustomerColumnsOptions = {}): ColumnDef<Customer>[] {
  const fullNameColumnSize = options.fullNameColumnSize ?? 220;
  const canUpdate = options.canUpdate ?? false;

  return [
    {
      id: "full_name",
      accessorKey: "full_name",
      size: fullNameColumnSize,
      minSize: fullNameColumnSize,
      header: ({ column }) => <DataTableColumnHeader column={column} title="CLIENTE" />,
      enableColumnFilter: true,
      meta: {
        label: "Cliente",
        placeholder: "Buscar por nombre...",
        variant: "text" as const,
      },
      cell: ({ row }) => {
        const { full_name, avatar_url, phone } = row.original;
        const initials = (full_name || "")
          .split(" ")
          .map((word) => word[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        return (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatar_url || ""} alt={full_name || "Cliente"} />
              <AvatarFallback>{initials || "??"}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium" title={full_name || "Sin nombre"}>
                {full_name || "Sin nombre"}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">{phone || "Sin teléfono"}</span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "created_at",
      size: 180,
      minSize: 170,
      header: ({ column }) => <DataTableColumnHeader column={column} title="CREACIÓN" />,
      meta: {
        label: "Fecha de creación",
      },
      cell: ({ row }) => {
        const formatted = formatDateTime(row.original.created_at);

        return (
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">{formatted.date}</span>
            {formatted.time ? <span className="text-[10px] text-muted-foreground">{formatted.time}</span> : null}
          </div>
        );
      },
    },
    {
      accessorKey: "updated_at",
      size: 180,
      minSize: 170,
      header: ({ column }) => <DataTableColumnHeader column={column} title="ACTUALIZACIÓN" />,
      meta: {
        label: "Fecha de actualización",
      },
      cell: ({ row }) => {
        const formatted = formatDateTime(row.original.updated_at);

        return (
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">{formatted.date}</span>
            {formatted.time ? <span className="text-[10px] text-muted-foreground">{formatted.time}</span> : null}
          </div>
        );
      },
    },
    {
      accessorKey: "is_active",
      size: 140,
      minSize: 130,
      header: "ESTADO",
      meta: {
        label: "Estado cliente",
      },
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            row.original.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
          }`}
        >
          {row.original.is_active ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    {
      accessorKey: "phone",
      size: 170,
      minSize: 160,
      header: "CONTACTO",
      meta: {
        label: "Contacto",
        disableRowClick: true,
      },
      cell: ({ row }) => <WhatsAppCell customer={row.original} />,
    },
    {
      id: "actions",
      size: 140,
      minSize: 130,
      header: "Acciones",
      meta: {
        label: "Acciones",
      },
      cell: ({ row }) => <CellAction data={row.original} canUpdate={canUpdate} />,
    },
  ];
}

export const columns = getColumns();
