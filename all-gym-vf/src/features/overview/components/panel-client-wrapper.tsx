'use client';

import { DashboardPeriodSelector } from './period-selector';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// Skeleton Components
function KPICardsSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className='@container/card'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <Skeleton className='h-9 w-9 rounded-lg' />
              <Skeleton className='h-4 w-24' />
            </div>
            <Skeleton className='h-8 w-32 mt-2' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-3 w-20' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className='h-5 w-40' />
        <Skeleton className='h-3 w-60' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-[200px] w-full' />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-5 w-40' />
        <Skeleton className='h-3 w-60' />
      </CardHeader>
      <CardContent className='space-y-3'>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className='flex items-center gap-3'>
            <Skeleton className='h-9 w-9 rounded-full' />
            <div className='flex-1'>
              <Skeleton className='h-4 w-32 mb-1' />
              <Skeleton className='h-3 w-20' />
            </div>
            <Skeleton className='h-6 w-16' />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface DashboardHeaderProps {
  periodLabel: string;
  onLoadingChange: (isLoading: boolean) => void;
}

export function DashboardHeader({ periodLabel, onLoadingChange }: DashboardHeaderProps) {
  return (
    <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-bold tracking-tight'>
          Estado del Negocio 📊
        </h1>
        <p className='text-muted-foreground'>
          ¿Cómo va el gimnasio {periodLabel}? Aquí tienes todos los indicadores clave.
        </p>
      </div>
      
      {/* Period Selector */}
      <DashboardPeriodSelector onLoadingChange={onLoadingChange} />
    </div>
  );
}

interface DashboardContentWrapperProps {
  children: React.ReactNode;
  isLoading: boolean;
}

export function DashboardContentWrapper({ children, isLoading }: DashboardContentWrapperProps) {
  if (isLoading) {
    return (
      <>
        {/* KPI Cards Skeleton */}
        <KPICardsSkeleton />

        {/* Main Grid Skeleton */}
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
          <div className='lg:col-span-4'>
            <ChartSkeleton className='h-full' />
          </div>
          <div className='lg:col-span-3'>
            <TableSkeleton />
          </div>
        </div>

        {/* Second Row Skeleton */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
          <ChartSkeleton />
          <ChartSkeleton />
          <div className='md:col-span-2'>
            <ChartSkeleton className='h-full' />
          </div>
        </div>

        {/* Alerts Row Skeleton */}
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <TableSkeleton />
          <TableSkeleton />
        </div>
      </>
    );
  }

  return <>{children}</>;
}
