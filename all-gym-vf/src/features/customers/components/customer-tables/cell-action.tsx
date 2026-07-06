"use client";
import { AlertModal } from "@/components/modal/alert-modal";
import { Button } from "@/components/ui/button";
import { Customer } from "./columns";
import { IconEdit, IconTrash, IconLoader2, IconUserOff, IconUserCheck } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CustomerFormSheet, CustomerData } from "../customer-form-sheet";
import { deleteCustomer, permanentlyDeleteCustomer, reactivateCustomer } from "../../actions/customer-actions";
import { toast } from "sonner";
import { useCustomer } from "../../hooks/use-customers";
import { CustomerStatusActionSummary } from "../customer-status-action-summary";

interface CellActionProps {
  data: Customer;
  canUpdate: boolean;
  canPermanentlyDelete: boolean;
}

type CustomerActionResult = {
  success: boolean;
  error?: string;
  deviceSync?: {
    attempted: boolean;
    action?: "enable" | "disable" | "delete";
    synced?: boolean;
    queued?: boolean;
  };
};

export const CellAction: React.FC<CellActionProps> = ({
  data,
  canUpdate,
  canPermanentlyDelete,
}) => {
  const [disableLoading, setDisableLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const router = useRouter();

  // Fetch automático cuando se abre el modal
  const { data: customerDetails, isPending: isPendingDetails } = useCustomer(editOpen ? data.id : null);

  // Combinar datos locales de la tabla con datos detallados del servidor si existen
  const customerToEdit = customerDetails
    ? ({
        ...customerDetails,
        full_name: customerDetails.full_name || data.full_name,
        email: customerDetails.email,
        phone: customerDetails.phone || data.phone,
        is_active: customerDetails.is_active ?? data.is_active,
      } as CustomerData)
    : null;

  const onConfirmDisable = async () => {
    setDisableLoading(true);
    try {
      const result = (data.is_active ? await deleteCustomer(data.id) : await reactivateCustomer(data.id)) as CustomerActionResult;
      if (result.success) {
        const deviceSync = result.deviceSync;
        const deviceSynced = deviceSync?.attempted ? deviceSync?.synced === true || deviceSync?.queued === true : null;

        if (data.is_active) {
          if (deviceSynced === false) {
            toast.warning("Cliente desactivado en el sistema, pero falló el envío al reloj.");
          } else {
            toast.success("Cliente desactivado y bloqueado en el reloj.");
          }
        } else if (deviceSynced === false) {
          toast.warning("Cliente reactivado en el sistema, pero falló el envío al reloj.");
        } else if (deviceSync?.action === "disable") {
          toast.success("Cliente reactivado, pero se mantuvo bloqueado en el reloj porque no tiene una suscripción activa.");
        } else {
          toast.success("Cliente reactivado y habilitado en el reloj.");
        }
        router.refresh();
      } else {
        toast.error(result.error || `Error al ${data.is_active ? "desactivar" : "reactivar"} el cliente`);
      }
    } catch {
      toast.error(`Error al ${data.is_active ? "desactivar" : "reactivar"} el cliente`);
    } finally {
      setDisableLoading(false);
      setDisableOpen(false);
    }
  };

  const onConfirmDelete = async () => {
    setDeleteLoading(true);
    try {
      const result = await permanentlyDeleteCustomer(data.id);
      if (result.success) {
        toast.success("Cliente eliminado del sistema. El reloj puede tardar unos segundos en reflejarlo.");
        router.refresh();
      } else {
        toast.error(result.error || "Error al eliminar completamente el cliente");
      }
    } catch {
      toast.error("Error al eliminar completamente el cliente");
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <AlertModal
        isOpen={disableOpen}
        onClose={() => setDisableOpen(false)}
        onConfirm={onConfirmDisable}
        loading={disableLoading}
        title={data.is_active ? "¿Desactivar cliente?" : "¿Reactivar cliente?"}
        description={
          <CustomerStatusActionSummary
            customerName={data.full_name}
            isActive={data.is_active === true}
            phone={data.phone}
            planName={data.plan_name}
            subscriptionStatus={data.subscription_status}
            subscriptionEndDate={data.subscription_end_date}
            subscriptionGraceDays={data.subscription_grace_days}
            subscriptionAccessUntil={data.subscription_access_until}
          />
        }
        confirmText={data.is_active ? "Desactivar" : "Reactivar"}
        confirmVariant={data.is_active ? "destructive" : "default"}
        contentClassName="sm:max-w-2xl"
      />

      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onConfirmDelete}
        loading={deleteLoading}
        title="¿Eliminar cliente completamente?"
        description={
          <div className="space-y-2 mt-2">
            <p>
              El cliente <span className="font-semibold text-foreground">{data.full_name}</span> se eliminará del
              sistema y del reloj.
            </p>
            <p className="text-sm text-destructive">
              Esta acción intenta borrar también sus huellas del dispositivo y no se puede deshacer.
            </p>
            <p className="text-sm text-muted-foreground">
              El reloj procesa la eliminación por cola ADMS, así que puede tardar unos segundos en desaparecer de la
              pantalla del equipo.
            </p>
          </div>
        }
        confirmText="Eliminar completamente"
      />

      <CustomerFormSheet
        mode="edit"
        customer={customerToEdit}
        open={editOpen}
        onOpenChange={setEditOpen}
        trigger={null}
      />

      <div className="flex items-center gap-2">
        {canPermanentlyDelete && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
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
        )}

        {canUpdate && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-amber-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setDisableOpen(true);
                }}
              >
                {data.is_active ? (
                  <IconUserOff className="h-4 w-4 text-amber-500" />
                ) : (
                  <IconUserCheck className="h-4 w-4 text-emerald-500" />
                )}
                <span className="sr-only">{data.is_active ? "Desactivar cliente" : "Reactivar cliente"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{data.is_active ? "Desactivar cliente" : "Reactivar cliente"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        )}

        {canUpdate && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteOpen(true);
                }}
              >
                <IconTrash className="h-4 w-4 text-destructive" />
                <span className="sr-only">Eliminar completamente</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Eliminar completamente</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        )}
      </div>
    </div>
  );
};
