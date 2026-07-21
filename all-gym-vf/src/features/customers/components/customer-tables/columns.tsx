"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { IconBrandWhatsapp } from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CustomerListItem } from "@/features/customers/lib/local-customers";
import { CustomerWhatsAppDialog } from "./customer-whatsapp-dialog";
import { CellAction } from "./cell-action";

export type Customer = CustomerListItem & {
  plan_id: number | null;
  plan_name: string | null;
  subscription_status: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  subscription_grace_days: number | null;
  subscription_access_until: string | null;
  subscription_display_status: string;
  injuries?: string | null;
  medical_notes?: string | null;
};

const membershipOptions = [
  { label: "Activa", value: "active" },
  { label: "Por vencer", value: "expiring" },
  { label: "En prórroga", value: "grace" },
  { label: "Vencida", value: "expired" },
  { label: "Cancelada", value: "cancelled" },
  { label: "Sin membresía", value: "none" },
];

function formatDate(value: string | null) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatCalendarDate(value: string | null) {
  if (!value) return "Sin vigencia";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

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
          <TooltipContent>Mandar mensaje</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <CustomerWhatsAppDialog open={open} onOpenChange={setOpen} customer={customer} />
    </>
  );
}

interface CustomerColumnsOptions {
  fullNameColumnSize?: number;
  canUpdate?: boolean;
}

export function getColumns(options: CustomerColumnsOptions = {}): ColumnDef<Customer>[] {
  const fullNameColumnSize = options.fullNameColumnSize ?? 220;

  return [
    {
      id: "full_name",
      accessorKey: "full_name",
      size: fullNameColumnSize,
      minSize: fullNameColumnSize,
      header: ({ column }) => <DataTableColumnHeader column={column} title="CLIENTE" />,
      enableColumnFilter: true,
      meta: { label: "Cliente", placeholder: "Buscar clientes...", variant: "text" as const },
      cell: ({ row }) => {
        const initials = row.original.full_name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
        return (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={row.original.avatar_url ?? ""} alt={row.original.full_name} />
              <AvatarFallback>{initials || "??"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.original.full_name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{row.original.phone || "Sin teléfono"}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "biometric_id",
      size: 115,
      header: "BIOMÉTRICO",
      cell: ({ row }) => <span className="font-mono text-xs">#{row.original.biometric_id}</span>,
    },
    {
      accessorKey: "plan_id",
      size: 170,
      header: "PLAN ACTUAL",
      enableColumnFilter: true,
      enableSorting: false,
      meta: { label: "ID del plan", placeholder: "ID del plan", variant: "number" as const },
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.plan_name ?? "Sin plan"}</p>
          {row.original.plan_id ? <p className="text-[10px] text-muted-foreground">Plan #{row.original.plan_id}</p> : null}
        </div>
      ),
    },
    {
      accessorKey: "membership_status",
      size: 145,
      header: ({ column }) => <DataTableColumnHeader column={column} title="MEMBRESÍA" />,
      enableColumnFilter: true,
      meta: { label: "Membresía", variant: "select" as const, options: membershipOptions },
      cell: ({ row }) => (
        <SubscriptionStatusBadge
          status={row.original.subscription_status}
          endDate={row.original.subscription_end_date}
          graceDays={row.original.subscription_grace_days}
          accessUntil={row.original.subscription_access_until}
          displayStatus={row.original.membership_status}
        />
      ),
    },
    {
      id: "validity",
      size: 190,
      header: "VIGENCIA",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.subscription_start_date || row.original.subscription_end_date
            ? `${formatCalendarDate(row.original.subscription_start_date)} – ${formatCalendarDate(row.original.subscription_end_date)}`
            : "Sin vigencia"}
        </span>
      ),
    },
    {
      accessorKey: "last_check_in",
      size: 170,
      header: ({ column }) => <DataTableColumnHeader column={column} title="ÚLTIMO INGRESO" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.last_check_in)}</span>,
    },
    {
      accessorKey: "is_active",
      size: 130,
      header: "CLIENTE",
      enableColumnFilter: true,
      enableSorting: false,
      meta: {
        label: "Estado cliente",
        variant: "select" as const,
        options: [{ label: "Activo", value: "true" }, { label: "Inactivo", value: "false" }],
      },
      cell: ({ row }) => (
        <span className={row.original.is_active ? "text-xs font-medium text-emerald-600" : "text-xs font-medium text-muted-foreground"}>
          {row.original.is_active ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      size: 150,
      header: ({ column }) => <DataTableColumnHeader column={column} title="CREACIÓN" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.created_at)}</span>,
    },
    {
      accessorKey: "updated_at",
      size: 150,
      header: ({ column }) => <DataTableColumnHeader column={column} title="ACTUALIZACIÓN" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.updated_at)}</span>,
    },
    {
      id: "contact",
      size: 90,
      header: "CONTACTO",
      enableSorting: false,
      meta: { label: "Contacto", disableRowClick: true },
      cell: ({ row }) => <WhatsAppCell customer={row.original} />,
    },
    {
      id: "actions",
      size: 120,
      header: "ACCIONES",
      enableSorting: false,
      meta: { label: "Acciones" },
      cell: ({ row }) => <CellAction data={row.original} canUpdate={options.canUpdate ?? false} />,
    },
  ];
}

export const columns = getColumns();
