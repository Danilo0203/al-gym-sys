import PageContainer from '@/components/layout/page-container';
import { Suspense } from 'react';
import PlanListingPage from '@/features/plans/components/plan-listing';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { PlanFormSheet } from '@/features/plans/components/plan-form-sheet';
import { searchParamsCache } from '@/lib/searchparams';
import { SearchParams } from 'nuqs/server';
import { getUserAccessContext, hasPermission } from '@/lib/auth/authorization';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Panel: Planes'
};

type pageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: pageProps) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect('/iniciar-sesion');
  }
  if (!hasPermission(access, "plans.view")) {
    redirect('/panel');
  }

  const searchParams = await props.searchParams;
  // Allow nested RSCs to access the search params (in a type-safe way)
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      scrollable={false}
      pageTitle='Planes de Membresía'
      pageDescription='Administra los planes y precios del gimnasio.'
      pageHeaderAction={hasPermission(access, "plans.create") ? <PlanFormSheet /> : null}
    >
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={5} rowCount={8} filterCount={2} />
        }
      >
        <PlanListingPage />
      </Suspense>
    </PageContainer>
  );
}
