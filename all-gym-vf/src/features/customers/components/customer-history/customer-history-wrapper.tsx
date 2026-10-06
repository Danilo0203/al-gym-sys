"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useCustomer,
  useCustomerBodyAssessments,
  useCustomerHealthProfile,
  useCustomerHistory,
} from "@/features/customers/hooks/use-customers";
import { CustomerHistoryClient } from "./customer-history-client";
import type { CustomerRoutineWorkspace } from "@/lib/training/types";

export default function CustomerHistoryWrapper({
  customerId,
  canManageRoutine,
  routineWorkspace,
}: {
  customerId: string;
  canManageRoutine: boolean;
  routineWorkspace: CustomerRoutineWorkspace | null;
}) {
  const [membershipsPage, setMembershipsPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [assessmentsPage, setAssessmentsPage] = useState(1);
  const historyParams = useMemo(() => new URLSearchParams({
    attendance_limit: "50",
    heatmap_days: "365",
    memberships_page: String(membershipsPage),
    memberships_page_size: "10",
    payments_page: String(paymentsPage),
    payments_page_size: "10",
    assessments_page: String(assessmentsPage),
    assessments_page_size: "10",
  }), [assessmentsPage, membershipsPage, paymentsPage]);
  const customerQuery = useCustomer(customerId);
  const historyQuery = useCustomerHistory(customerId, historyParams);
  const canViewHealth = customerQuery.data?.capabilities.view_health_profile === true;
  const canViewAssessments = customerQuery.data?.capabilities.view_body_assessments === true;
  const healthQuery = useCustomerHealthProfile(customerId, canViewHealth);
  const assessmentsQuery = useCustomerBodyAssessments(customerId, assessmentsPage, 10, canViewAssessments);

  if (customerQuery.isPending || historyQuery.isPending || (canViewHealth && healthQuery.isPending) || (canViewAssessments && assessmentsQuery.isPending)) {
    return <div className="h-full min-h-96 animate-pulse bg-muted/20" />;
  }

  const protectedQueryError = canViewHealth && healthQuery.isError
    ? healthQuery.error
    : canViewAssessments && assessmentsQuery.isError
      ? assessmentsQuery.error
      : null;

  if (customerQuery.isError || historyQuery.isError || protectedQueryError) {
    const error = customerQuery.error ?? historyQuery.error ?? protectedQueryError;
    const status = error && "status" in error ? error.status : null;
    return (
      <Card className="m-6 border-destructive/30">
        <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
          <div>
            <p className="font-semibold">{status === 404 ? "Cliente no encontrado" : status === 403 ? "Sin permiso para ver este historial" : "No se pudo cargar el historial"}</p>
            <p className="text-sm text-muted-foreground">{error?.message}</p>
          </div>
          <Button variant="outline" onClick={() => Promise.all([
            customerQuery.refetch(),
            historyQuery.refetch(),
            ...(canViewHealth ? [healthQuery.refetch()] : []),
            ...(canViewAssessments ? [assessmentsQuery.refetch()] : []),
          ])}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <CustomerHistoryClient
      profile={customerQuery.data}
      history={historyQuery.data}
      canManageRoutine={canManageRoutine}
      routineWorkspace={routineWorkspace}
      healthProfile={canViewHealth ? healthQuery.data : undefined}
      bodyAssessments={canViewAssessments ? assessmentsQuery.data : undefined}
      membershipsPage={membershipsPage}
      paymentsPage={paymentsPage}
      assessmentsPage={assessmentsPage}
      onMembershipsPageChange={setMembershipsPage}
      onPaymentsPageChange={setPaymentsPage}
      onAssessmentsPageChange={setAssessmentsPage}
      isRefreshing={historyQuery.isFetching || healthQuery.isFetching || assessmentsQuery.isFetching}
    />
  );
}
