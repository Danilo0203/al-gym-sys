"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertModal } from "@/components/modal/alert-modal";
import { CustomerFormSheet, type CustomerData } from "../customer-form-sheet";
import { CustomerStatusActionSummary } from "../customer-status-action-summary";
import {
  useCustomer,
  useUpdateCustomerStatus,
} from "../../hooks/use-customers";
import type { Customer } from "./columns";
import {
  IconEdit,
  IconLoader2,
  IconUserCheck,
  IconUserOff,
} from "@tabler/icons-react";
interface CellActionProps {
  data: Customer;
  canUpdate: boolean;
}

export const CellAction: React.FC<CellActionProps> = ({ data, canUpdate }) => {
  const [statusOpen, setStatusOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { data: customerDetails, isPending: isPendingDetails } = useCustomer(
    editOpen ? data.id : null,
  );
  const statusMutation = useUpdateCustomerStatus();

  const customerToEdit = customerDetails
    ? ({
        ...customerDetails,
        full_name: customerDetails.full_name || data.full_name,
        email: customerDetails.email,
        phone: customerDetails.phone || data.phone,
        is_active: customerDetails.is_active ?? data.is_active,
      } as unknown as CustomerData)
    : null;

  const onConfirmStatusChange = async () => {
    try {
      await statusMutation.mutateAsync({
        id: data.id,
        isActive: !data.is_active,
      });
    } finally {
      setStatusOpen(false);
    }
  };

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <AlertModal
        isOpen={statusOpen}
        onClose={() => setStatusOpen(false)}
        onConfirm={onConfirmStatusChange}
        loading={statusMutation.isPending}
        title={data.is_active ? "¿Suspender cliente?" : "¿Reactivar cliente?"}
        description={
          <CustomerStatusActionSummary
            customerName={data.full_name}
            isActive={data.is_active}
            phone={data.phone}
          />
        }
        confirmText={data.is_active ? "Suspender" : "Reactivar"}
        confirmVariant={data.is_active ? "destructive" : "default"}
        contentClassName="sm:max-w-2xl"
      />

      <CustomerFormSheet
        mode="edit"
        customer={customerToEdit}
        open={editOpen}
        onOpenChange={setEditOpen}
        trigger={null}
      />

      <div className="flex items-center gap-2">
        {canUpdate ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditOpen(true);
                  }}
                  disabled={editOpen && isPendingDetails}
                >
                  {editOpen && isPendingDetails ? (
                    <IconLoader2 className="h-4 w-4 animate-spin text-blue-500" />
                  ) : (
                    <IconEdit className="h-4 w-4 text-blue-500" />
                  )}
                  <span className="sr-only">Editar cliente</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Editar cliente</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}

        {canUpdate ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-amber-500/10"
                  onClick={(event) => {
                    event.stopPropagation();
                    setStatusOpen(true);
                  }}
                >
                  {data.is_active ? (
                    <IconUserOff className="h-4 w-4 text-amber-500" />
                  ) : (
                    <IconUserCheck className="h-4 w-4 text-emerald-500" />
                  )}
                  <span className="sr-only">
                    {data.is_active ? "Suspender cliente" : "Reactivar cliente"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {data.is_active ? "Suspender cliente" : "Reactivar cliente"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}

        {canUpdate ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-destructive/10"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <span className="sr-only">Eliminar completamente</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Eliminar completamente</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
    </div>
  );
};
