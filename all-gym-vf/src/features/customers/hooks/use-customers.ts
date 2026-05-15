"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCustomerById,
  createCustomer,
  updateCustomer,
  CreateCustomerData,
  reactivateCustomer,
} from "../actions/customer-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export const customersKeys = {
  all: ["customers"] as const,
  lists: () => [...customersKeys.all, "list"] as const,
  detail: (id: string) => [...customersKeys.all, "detail", id] as const,
};

type CustomerMutationResult = {
  success: boolean;
  error?: string;
  deviceSync?: {
    attempted: boolean;
    action?: "enable" | "disable" | "delete";
    synced?: boolean;
    queued?: boolean;
  };
};

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: customersKeys.detail(id || ""),
    queryFn: () => getCustomerById(id!),
    enabled: !!id, // Solo ejecutar si hay ID
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: CreateCustomerData) => {
      const result = await createCustomer(data);
      if (!result.success) {
        throw new Error(result.error || "Error al crear");
      }
      return result;
    },
    onSuccess: (result) => {
      const deviceSync = (result as CustomerMutationResult).deviceSync;
      const deviceSynced = deviceSync?.attempted ? deviceSync?.synced === true || deviceSync?.queued === true : null;

      if (deviceSynced === false) {
        toast.warning("Cliente creado, pero falló el envío automático al dispositivo.");
      } else if (deviceSynced === true && deviceSync?.action === "disable") {
        toast.success("Cliente creado. El reloj quedará bloqueado hasta que tenga una suscripción activa.");
      } else if (deviceSynced === true) {
        toast.success("Cliente creado y sincronizado con el reloj.");
      } else {
        toast.success("Cliente creado exitosamente");
      }
      queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      router.refresh();
    },
    onError: (error) => {
      console.error(error);
      toast.error(error.message || "Error al crear el cliente");
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateCustomerData> }) => {
      const result = await updateCustomer(id, data);
      if (!result.success) {
        throw new Error(result.error || "Error al actualizar");
      }
      return result;
    },
    onSuccess: (result, variables) => {
      const deviceSync = (result as CustomerMutationResult).deviceSync;
      const deviceSynced = deviceSync?.attempted ? deviceSync?.synced === true || deviceSync?.queued === true : null;

      if (deviceSynced === false) {
        toast.warning("Cliente actualizado, pero falló la sincronización con el reloj.");
      } else if (deviceSynced === true && deviceSync?.action === "enable") {
        toast.success("Cliente actualizado y sincronizado con el reloj.");
      } else if (deviceSynced === true && deviceSync?.action === "disable") {
        toast.success("Cliente actualizado. El reloj quedó bloqueado según el estado actual del cliente.");
      } else {
        toast.success("Cliente actualizado exitosamente");
      }
      queryClient.invalidateQueries({ queryKey: customersKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      router.refresh();
    },
    onError: (error: Error) => {
      console.error(error);
      toast.error(error.message || "Error al actualizar el cliente");
    },
  });
}

export function useReactivateCustomer() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await reactivateCustomer(id);
      if (!result.success) {
        throw new Error(result.error || "Error al reactivar cliente");
      }
      return result;
    },
    onSuccess: (result, id) => {
      const deviceSync = (result as CustomerMutationResult).deviceSync;
      const deviceSynced = deviceSync?.attempted ? deviceSync?.synced === true || deviceSync?.queued === true : null;

      if (deviceSynced === false) {
        toast.warning("Cliente reactivado, pero falló la sincronización con el reloj.");
      } else if (deviceSync?.action === "disable") {
        toast.success("Cliente reactivado. El reloj seguirá bloqueado hasta que la suscripción esté activa.");
      } else {
        toast.success("Cliente reactivado exitosamente");
      }
      queryClient.invalidateQueries({ queryKey: customersKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      router.refresh();
    },
    onError: (error: Error) => {
      console.error(error);
      toast.error(error.message || "Error al reactivar cliente");
    },
  });
}
