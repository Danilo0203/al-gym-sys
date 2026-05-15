import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export function ProfileSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-2 md:p-4 animate-pulse">
      {/* Profile Header Skeleton */}
      <Card className="border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent py-4 gap-4">
        <CardContent className="p-4">
          <div className="flex flex-col items-center gap-4 md:flex-row">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex flex-1 flex-col items-center gap-2 text-center md:items-start md:text-left">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Profile Forms Skeleton */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-24" />
        </Card>
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-32" />
        </Card>
      </div>
    </div>
  );
}
