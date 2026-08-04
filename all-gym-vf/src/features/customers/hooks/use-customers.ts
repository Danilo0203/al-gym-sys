"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createCustomer,
  createCustomerBodyAssessment,
  getCustomerBodyAssessments,
  getCustomerDetail,
  getCustomerHealthProfile,
  getCustomerHistory,
  getCustomersList,
  updateCustomer,
  updateCustomerAccount,
  updateCustomerBodyAssessment,
  updateCustomerHealthProfile,
  updateCustomerStatus,
} from "@/features/customers/lib/customer-api";
import type {
  BodyAssessmentWriteInput,
  CustomerHealthProfileUpdateInput,
} from "@/features/customers/lib/customer-health";
import type {
  CreateCustomerInput,
  CustomerDetail,
  UpdateCustomerInput,
  UpdateCustomerAccountInput,
} from "@/features/customers/lib/local-customers";

export const customersKeys = {
  all: ["customers"] as const,
  lists: () => [...customersKeys.all, "list"] as const,
  detail: (id: string) => [...customersKeys.all, "detail", id] as const,
  history: (id: string, query: string) => [...customersKeys.detail(id), "history", query] as const,
  healthProfile: (id: string) => [...customersKeys.detail(id), "health-profile"] as const,
  bodyAssessments: (id: string) => [...customersKeys.detail(id), "body-assessments"] as const,
  bodyAssessmentsPage: (id: string, page: number, pageSize: number) =>
    [...customersKeys.bodyAssessments(id), page, pageSize] as const,
};

export function useCustomersList(query: URLSearchParams) {
  const queryString = query.toString();

  return useQuery({
    queryKey: [...customersKeys.lists(), queryString],
    queryFn: () => getCustomersList(`/api/customers?${queryString}`),
    retry: 1,
    staleTime: 0,
  });
}

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: customersKeys.detail(id || ""),
    queryFn: () => getCustomerDetail(id!),
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useCustomerHistory(id: string, query: URLSearchParams) {
  const queryString = query.toString();

  return useQuery({
    queryKey: customersKeys.history(id, queryString),
    queryFn: () => getCustomerHistory(id, new URLSearchParams(queryString)),
    retry: 1,
    staleTime: 0,
  });
}

export function useCustomerHealthProfile(id: string, enabled: boolean) {
  return useQuery({
    queryKey: customersKeys.healthProfile(id),
    queryFn: () => getCustomerHealthProfile(id),
    enabled: Boolean(id) && enabled,
    staleTime: 0,
  });
}

export function useCustomerBodyAssessments(id: string, page: number, pageSize: number, enabled: boolean) {
  return useQuery({
    queryKey: customersKeys.bodyAssessmentsPage(id, page, pageSize),
    queryFn: () => getCustomerBodyAssessments(id, page, pageSize),
    enabled: Boolean(id) && enabled,
    staleTime: 0,
  });
}

export function useUpdateCustomerHealthProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CustomerHealthProfileUpdateInput }) =>
      updateCustomerHealthProfile(id, data),
    onSuccess: (profile) => {
      queryClient.setQueryData(customersKeys.healthProfile(profile.customer_id), profile);
      queryClient.invalidateQueries({ queryKey: customersKeys.detail(profile.customer_id) });
      toast.success("Perfil de salud actualizado.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No fue posible actualizar salud."),
  });
}

export function useCreateCustomerBodyAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BodyAssessmentWriteInput }) =>
      createCustomerBodyAssessment(id, data),
    onSuccess: (assessment) => {
      queryClient.invalidateQueries({ queryKey: customersKeys.bodyAssessments(assessment.customer_id) });
      queryClient.invalidateQueries({ queryKey: [...customersKeys.detail(assessment.customer_id), "history"] });
      toast.success("Evaluación corporal creada.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No fue posible crear la evaluación."),
  });
}

export function useUpdateCustomerBodyAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assessmentId, data }: { id: string; assessmentId: string; data: BodyAssessmentWriteInput }) =>
      updateCustomerBodyAssessment(id, assessmentId, data),
    onSuccess: (assessment) => {
      queryClient.invalidateQueries({ queryKey: customersKeys.bodyAssessments(assessment.customer_id) });
      queryClient.invalidateQueries({ queryKey: [...customersKeys.detail(assessment.customer_id), "history"] });
      toast.success("Evaluación corporal actualizada.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No fue posible actualizar la evaluación."),
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

export function useUpdateCustomerAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerAccountInput }) =>
      updateCustomerAccount(id, data),
    onSuccess: (customer) => {
      queryClient.setQueryData(customersKeys.detail(customer.id), customer);
      queryClient.invalidateQueries({ queryKey: customersKeys.detail(customer.id) });
      queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      toast.success("Cuenta actualizada correctamente.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error inesperado al actualizar la cuenta.");
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
