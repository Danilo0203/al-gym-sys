"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createCustomer,
  getCustomerDetail,
  updateCustomer,
  updateCustomerStatus,
} from "@/features/customers/lib/customer-api";
import type {
  CreateCustomerInput,
  CustomerDetail,
  UpdateCustomerInput,
} from "@/features/customers/lib/local-customers";

export const customersKeys = {
  all: ["customers"] as const,
  lists: () => [...customersKeys.all, "list"] as const,
  detail: (id: string) => [...customersKeys.all, "detail", id] as const,
};

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: customersKeys.detail(id || ""),
    queryFn: () => getCustomerDetail(id!),
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: CreateCustomerInput) => createCustomer(data),
    onSuccess: () => {
      toast.success("Cliente creado correctamente.");
      queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      router.refresh();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al crear el cliente.");
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerInput }) => updateCustomer(id, data),
    onSuccess: (_result, variables) => {
      toast.success("Cliente actualizado correctamente.");
      queryClient.invalidateQueries({ queryKey: customersKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      router.refresh();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al actualizar el cliente.");
    },
  });
}

export function useUpdateCustomerStatus() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateCustomerStatus(id, isActive),
    onSuccess: (customer: CustomerDetail) => {
      toast.success(
        customer.is_active
          ? "Cliente reactivado correctamente. Esta acción todavía no sincroniza con reloj biométrico en Fase A."
          : "Cliente suspendido correctamente. Esta acción todavía no sincroniza con reloj biométrico en Fase A.",
      );
      queryClient.invalidateQueries({ queryKey: customersKeys.detail(customer.id) });
      queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      router.refresh();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al actualizar el estado del cliente.");
    },
  });
}

export function useReactivateCustomer() {
  const mutation = useUpdateCustomerStatus();

  return {
    ...mutation,
    mutateAsync: async (id: string) => mutation.mutateAsync({ id, isActive: true }),
  };
}
