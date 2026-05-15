import { Suspense } from "react";
import CustomerHistoryWrapper from "@/features/customers/components/customer-history/customer-history-wrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

interface CustomerHistoryPageProps {
  params: Promise<{ customerId: string }>;
}

export default async function CustomerHistoryPage({ params }: CustomerHistoryPageProps) {
  const { customerId } = await params;

  return (
    <div className="flex flex-col gap-6 p-6 flex-1 min-h-0">
      <Suspense fallback={<HistoryLoadingSkeleton />}>
        <CustomerHistoryWrapper customerId={customerId} />
      </Suspense>
    </div>
  );
}

function HistoryLoadingSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background/50 animate-pulse">
      {/* Skeleton Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur p-4 pb-2 lg:p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-1/3" />
            <div className="flex gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
        <div className="flex gap-4 mt-6">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Skeleton Content */}
      <div className="p-4 lg:p-8 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-none shadow-sm bg-card/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-5 rounded-md" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-32 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
