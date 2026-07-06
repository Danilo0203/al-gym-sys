"use client";

import { ColumnDef } from "@tanstack/react-table";
import { CellAction } from "./cell-action";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { IconBrandWhatsapp } from "@tabler/icons-react";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CustomerWhatsAppDialog } from "./customer-whatsapp-dialog";
import { useState } from "react";

function WhatsAppCell({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
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
      <CustomerWhatsAppDialog
        open={open}
        onOpenChange={setOpen}
        customer={customer}
      />
    </>
  );
}

export type Customer = {
  id: string;
  full_name: string | null;
  created_at?: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  subscription_status: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  subscription_grace_days?: number | null;
  subscription_access_until?: string | null;
  subscription_display_status?: string | null;
  plan_name: string | null;
  last_check_in: string | null;
  is_active: boolean | null;
  email: string | null;
  biometric_id?: number | null;
};

export interface PlanOption {
  label: string;
  value: string;
}

interface CustomerColumnsOptions {
  fullNameColumnSize?: number;
  canUpdate?: boolean;
  canPermanentlyDelete?: boolean;
}

// Función factory para crear columnas con opciones dinámicas
export function getColumns(
  planOptions: PlanOption[] = [],
  options: CustomerColumnsOptions = {},
): ColumnDef<Customer>[] {
  const fullNameColumnSize = options.fullNameColumnSize ?? 220;
  const canUpdate = options.canUpdate ?? false;
  const canPermanentlyDelete = options.canPermanentlyDelete ?? false;

  return [
    {
      accessorKey: "biometric_id",
      size: 120,
      minSize: 110,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" />
      ),
      meta: {
        label: "ID",
      },
      cell: ({ row }) => {
        const biometricId = row.original.biometric_id;

        return (
          <span className="text-sm text-muted-foreground">
            {biometricId ?? "—"}
          </span>
        );
      },
    },
    {
      id: "full_name",
      accessorKey: "full_name",
      size: fullNameColumnSize,
      minSize: fullNameColumnSize,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="CLIENTE" />
      ),
      enableColumnFilter: true,
      meta: {
        label: "Cliente",
        placeholder: "Buscar por nombre...",
        variant: "text" as const,
      },
      cell: ({ row }) => {
        const { full_name, avatar_url, phone } = row.original;
        const initials = full_name
          ? full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .substring(0, 2)
          : "??";

        return (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatar_url || ""} alt={full_name || ""} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span
                className="truncate font-medium text-sm"
                title={full_name || ""}
              >
                {full_name}
              </span>
              {phone && (
                <span className="truncate text-[11px] text-muted-foreground">
                  {phone}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "created_at",
      size: 180,
      minSize: 170,
      header: "CREACIÓN",
      meta: {
        label: "Fecha de creación",
      },
      cell: ({ row }) => {
        const date = row.original.created_at;
        if (!date) return <span className="text-muted-foreground">-</span>;

        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) {
          return <span className="text-sm text-muted-foreground">{date}</span>;
        }

        return (
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">
              {format(parsedDate, "dd/MM/yyyy", { locale: es })}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {format(parsedDate, "HH:mm 'hs'", { locale: es })}
            </span>
          </div>
        );
      },
    },

    {
      accessorKey: "is_active",
      size: 140,
      minSize: 130,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ACTIVO" />
      ),
      enableColumnFilter: true,
      meta: {
        label: "Estado cliente",
        variant: "multiSelect" as const,
        options: [
          { label: "Activo", value: "Active" },
          { label: "Inactivo", value: "Inactive" },
        ],
      },
      cell: ({ row }) => {
        const isActive = row.original.is_active;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isActive
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {isActive ? "Activo" : "Inactivo"}
          </span>
        );
      },
    },
    {
      accessorKey: "subscription_status",
      size: 170,
      minSize: 160,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="SUSCRIPCIÓN" />
      ),
      enableColumnFilter: true,
      meta: {
        label: "Estado suscripción",
        variant: "multiSelect" as const,
        options: [
          { label: "Activa", value: "active" },
          { label: "Por vencer", value: "expiring" },
          { label: "Vencida", value: "expired" },
          { label: "Cancelada", value: "cancelled" },
        ],
      },
      cell: ({ row }) => (
        <SubscriptionStatusBadge
          status={row.original.subscription_status}
          endDate={row.original.subscription_end_date}
          graceDays={row.original.subscription_grace_days}
          accessUntil={row.original.subscription_access_until}
          displayStatus={row.original.subscription_display_status}
        />
      ),
    },
    {
      id: "plan_name",
      accessorKey: "plan_name",
      size: 210,
      minSize: 180,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="PLAN ACTUAL" />
      ),
      enableColumnFilter: true,
      meta: {
        label: "Plan actual",
        variant: "multiSelect" as const,
        options: planOptions,
      },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.plan_name || "-"}
        </span>
      ),
    },
    {
      accessorKey: "subscription_start_date",
      size: 150,
      minSize: 140,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="INICIO" />
      ),
      meta: {
        label: "Inicio",
      },
      cell: ({ row }) => {
        const date = row.original.subscription_start_date;
        if (!date) return <span className="text-muted-foreground">-</span>;

        let parsedDate: Date;
        if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          const [year, month, day] = date.split("-").map(Number);
          parsedDate = new Date(year, month - 1, day);
        } else {
          parsedDate = new Date(date);
        }

        return (
          <span className="text-sm text-muted-foreground">
            {format(parsedDate, "dd/MM/yyyy")}
          </span>
        );
      },
    },
    {
      accessorKey: "subscription_end_date",
      size: 190,
      minSize: 180,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="VENCIMIENTO" />
      ),
      meta: {
        label: "Vencimiento",
      },
      cell: ({ row }) => {
        const date = row.original.subscription_end_date;
        if (!date) return <span className="text-muted-foreground">-</span>;

        let parsedDate: Date;
        if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          const [year, month, day] = date.split("-").map(Number);
          parsedDate = new Date(year, month - 1, day);
        } else {
          parsedDate = new Date(date);
        }

        const daysLeft = differenceInDays(parsedDate, new Date());

        let textClass = "text-muted-foreground";
        if (daysLeft < 0) textClass = "text-destructive font-medium";
        else if (daysLeft <= 3) textClass = "text-yellow-600 font-medium";

        return (
          <div className="flex flex-col">
            <span className={textClass}>
              {format(parsedDate, "dd/MM/yyyy")}
            </span>
            {daysLeft >= 0 && daysLeft <= 30 && (
              <span className="text-[10px] text-muted-foreground">
                En {daysLeft} días
              </span>
            )}
            {daysLeft < 0 && (
              <span className="text-[10px] text-destructive">
                Venció hace {Math.abs(daysLeft)} días
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "phone",
      size: 170,
      minSize: 160,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="TELÉFONO" />
      ),
      meta: {
        label: "Teléfono",
        disableRowClick: true,
      },
      cell: ({ row }) => {
        const phone = row.original.phone;
        if (!phone) return <span className="text-muted-foreground">-</span>;

        return <WhatsAppCell customer={row.original} />;
      },
    },
    {
      accessorKey: "last_check_in",
      size: 170,
      minSize: 160,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ÚLTIMO INGRESO" />
      ),
      meta: {
        label: "Último ingreso",
      },
      cell: ({ row }) => {
        const date = row.original.last_check_in;
        if (!date)
          return <span className="text-muted-foreground text-xs">Nunca</span>;

        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) {
          return <span className="text-sm text-muted-foreground">{date}</span>;
        }

        return (
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">
              {format(parsedDate, "dd/MM/yyyy", { locale: es })}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {format(parsedDate, "HH:mm 'hs'", { locale: es })}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      size: 140,
      minSize: 130,
      header: "Acciones",
      meta: {
        label: "Acciones",
      },
      cell: ({ row }) => (
        <CellAction
          data={row.original}
          canUpdate={canUpdate}
          canPermanentlyDelete={canPermanentlyDelete}
        />
      ),
    },
  ];
}

// Export estático para compatibilidad (sin opciones de plan dinámicas)
export const columns = getColumns([]);
