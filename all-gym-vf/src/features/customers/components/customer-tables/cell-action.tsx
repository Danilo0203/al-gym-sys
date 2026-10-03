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
  useCustomerBodyAssessments,
  useCustomerHealthProfile,
  useUpdateCustomerStatus,
} from "../../hooks/use-customers";
import type { Customer } from "./columns";
import type { EquipmentOption, FocusArea, PrimaryGoal, RestrictedMovement } from "@/lib/training/types";
import {
  IconEdit,
  IconLoader2,
  IconUserCheck,
  IconUserOff,
} from "@tabler/icons-react";

function parseRestrictedMovements(value?: string | string[] | null): RestrictedMovement[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as RestrictedMovement[];
  return value.split(",").map((s) => s.trim()).filter(Boolean) as RestrictedMovement[];
}

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
  const { data: healthProfile, isPending: isPendingHealth } = useCustomerHealthProfile(
    data.id,
    editOpen,
  );
  const { data: bodyAssessments, isPending: isPendingAssessments } = useCustomerBodyAssessments(
    data.id,
    1,
    1,
    editOpen,
  );
  const statusMutation = useUpdateCustomerStatus();

  const isDataLoading = isPendingDetails || isPendingHealth || isPendingAssessments;
  const latestAssessment = bodyAssessments?.data?.[0];

  const customerToEdit = !isDataLoading && customerDetails
    ? ({
        ...customerDetails,
        full_name: customerDetails.full_name || data.full_name,
        email: customerDetails.account?.email ?? customerDetails.email ?? null,
        phone: customerDetails.phone || data.phone,
        is_active: customerDetails.is_active ?? data.is_active,
        injuries: customerDetails.injuries ?? null,
        medical_notes: customerDetails.medical_notes ?? null,

        // Perfil de salud y entrenamiento
        primary_goal: (healthProfile?.primary_goal as PrimaryGoal) ?? null,
        secondary_goal: (healthProfile?.secondary_goal as PrimaryGoal) ?? null,
        focus_areas: (healthProfile?.focus_areas as FocusArea[]) ?? [],
        experience_level: (healthProfile?.experience_level as "beginner" | "intermediate" | "advanced") ?? null,
        days_per_week: healthProfile?.days_per_week ?? null,
        session_minutes: healthProfile?.session_minutes ?? null,
        training_location: (healthProfile?.training_location as "gym" | "home" | "mixed") ?? null,
        equipment_available: (healthProfile?.equipment_available as EquipmentOption[]) ?? [],
        cardio_preference: (healthProfile?.cardio_preference as "none" | "light" | "moderate" | "high") ?? null,
        parq_requires_attention: healthProfile?.parq_requires_attention ?? null,
        restricted_movements: parseRestrictedMovements(healthProfile?.restricted_movements),
        exercise_preferences: healthProfile?.exercise_preferences ?? null,
        exercise_dislikes: healthProfile?.exercise_dislikes ?? null,
        injuries_or_pain: healthProfile?.injuries_or_pain ?? null,
        medical_clearance_notes: healthProfile?.medical_clearance_notes ?? null,

        // Medidas y nutrición
        weight_kg: latestAssessment?.weight_kg ?? null,
        height_cm: latestAssessment?.height_cm ?? null,
        body_type: latestAssessment?.body_type ?? latestAssessment?.nutrition_snapshot?.body_type ?? null,
        diet_type: healthProfile?.diet_type ?? latestAssessment?.diet_type ?? latestAssessment?.nutrition_snapshot?.diet_type ?? null,
        activity_level: healthProfile?.activity_level ?? latestAssessment?.activity_level ?? latestAssessment?.nutrition_snapshot?.activity_level ?? null,
        body_fat_percentage: latestAssessment?.body_fat_percentage ?? null,
        muscle_mass_kg: latestAssessment?.muscle_mass_kg ?? null,
        chest: latestAssessment?.chest ?? null,
        waist: latestAssessment?.waist ?? null,
        hip: latestAssessment?.hip ?? null,
        arm_right: latestAssessment?.arm_right ?? null,
        arm_left: latestAssessment?.arm_left ?? null,
        leg_right: latestAssessment?.leg_right ?? null,
        leg_left: latestAssessment?.leg_left ?? null,

        // Membresía actual
        plan_id: customerDetails.current_membership?.plan_id ?? null,
        subscription_start_date: customerDetails.current_membership?.start_date ?? null,
        subscription_end_date: customerDetails.current_membership?.end_date ?? null,
        subscription_grace_days: customerDetails.current_membership?.grace_days ?? null,
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
                  disabled={editOpen && isDataLoading}
                >
                  {editOpen && isDataLoading ? (
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
