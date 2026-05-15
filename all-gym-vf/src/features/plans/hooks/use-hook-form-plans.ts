"use client";

import { useEffect } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plan } from "../actions/plan-actions";
import { useCreatePlan, useUpdatePlan } from "./use-plans";

const planFormSchema = z.object({
  name: z.string().min(2, { message: "El nombre es obligatorio" }),
  description: z.string().optional(),
  price: z.coerce.number().min(0, { message: "El precio debe ser mayor o igual a 0" }),
  duration_days: z.coerce.number().min(1, { message: "La duración debe ser al menos 1 día" }),
  is_active: z.boolean().default(true),
});

export type PlanFormValues = z.infer<typeof planFormSchema>;
export type PlanFormInput = z.input<typeof planFormSchema>;

interface UseHookFormPlansParams {
  open: boolean;
  mode?: "create" | "edit";
  plan?: Plan | null;
  onClose: () => void;
}

interface UseHookFormPlansResult {
  form: UseFormReturn<PlanFormInput, unknown, PlanFormValues>;
  isPending: boolean;
  isEditing: boolean;
  onSubmit: (values: PlanFormValues) => Promise<void>;
}

export function useHookFormPlans({
  open,
  mode = "create",
  plan = null,
  onClose,
}: UseHookFormPlansParams): UseHookFormPlansResult {
  const { mutateAsync: createPlanMutation, isPending: isCreating } = useCreatePlan();
  const { mutateAsync: updatePlanMutation, isPending: isUpdating } = useUpdatePlan();
  const isPending = isCreating || isUpdating;
  const isEditing = mode === "edit" && plan !== null;

  const form = useForm<PlanFormInput, unknown, PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      duration_days: 30,
      is_active: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (isEditing && plan) {
      form.reset({
        name: plan.name,
        description: plan.description || "",
        price: plan.price,
        duration_days: plan.duration_days,
        is_active: plan.is_active,
      });
      return;
    }
    form.reset({
      name: "",
      description: "",
      price: 0,
      duration_days: 30,
      is_active: true,
    });
  }, [open, isEditing, plan, form]);

  async function onSubmit(values: PlanFormValues) {
    if (isEditing && plan) {
      const result = await updatePlanMutation({ id: plan.id, data: values });
      if (result.success) onClose();
      return;
    }

    const result = await createPlanMutation(values);
    if (result.success) onClose();
  }

  return {
    form,
    isPending,
    isEditing,
    onSubmit,
  };
}
