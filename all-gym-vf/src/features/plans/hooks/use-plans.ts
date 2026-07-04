'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlans, createPlan, updatePlan, deletePlan, CreatePlanData, UpdatePlanData } from '../actions/plan-actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function usePlans(includeInactive = false) {
  return useQuery({
    queryKey: ['plans', { includeInactive }],
    queryFn: () => getPlans(includeInactive),
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: CreatePlanData) => createPlan(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Plan creado exitosamente');
        queryClient.invalidateQueries({ queryKey: ['plans'] });
        router.refresh(); // Para actualizar componentes de servidor si los hay
      } else {
        toast.error(`Error: ${result.error}`);
      }
    },
    onError: (error) => {
      toast.error('Error al crear el plan');
      console.error(error);
    }
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePlanData }) => updatePlan(id, data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Plan actualizado exitosamente');
        queryClient.invalidateQueries({ queryKey: ['plans'] });
        router.refresh();
      } else {
        toast.error(`Error: ${result.error}`);
      }
    },
    onError: (error) => {
      toast.error('Error al actualizar el plan');
      console.error(error);
    }
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => deletePlan(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || 'Plan eliminado correctamente');
        queryClient.invalidateQueries({ queryKey: ['plans'] });
        router.refresh();
      } else {
        toast.error(`Error: ${result.error}`);
      }
    },
    onError: (error) => {
      toast.error('Error al eliminar el plan');
      console.error(error);
    }
  });
}
