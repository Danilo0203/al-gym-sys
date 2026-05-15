import { Skeleton } from "@/components/ui/skeleton";

export function KPICardsSkeleton() {
  return (
    <div data-testid="dashboard-loading-indicator" aria-live="polite">
      <p className="mb-3 text-sm text-muted-foreground">Cargando resumen...</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card text-card-foreground shadow p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RevenueChartSkeleton() {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow">
      <div className="p-6 space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-60" />
      </div>
      <div className="p-6 pt-0">
        <Skeleton className="h-[350px] w-full" />
      </div>
    </div>
  );
}

export function RecentPaymentsSkeleton() {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow h-full">
      <div className="p-6 space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-60" />
      </div>
      <div className="p-6 pt-0 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex iems-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="space-y-1 text-right">
              <Skeleton className="h-4 w-12 ml-auto" />
              <Skeleton className="h-3 w-20 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlanDistributionSkeleton() {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow">
      <div className="p-6 space-y-1">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="p-6 pt-0 flex justify-center">
        <Skeleton className="h-[200px] w-[200px] rounded-full" />
      </div>
    </div>
  );
}

export function GenericChartSkeleton() {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow h-full">
      <div className="p-6 space-y-1">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="p-6 pt-0">
        <Skeleton className="h-[200px] w-full" />
      </div>
    </div>
  );
}
