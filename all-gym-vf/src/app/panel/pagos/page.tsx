import PageContainer from '@/components/layout/page-container';
import { LocalRuntimeModuleState } from '@/components/layout/local-runtime-module-state';
import PaymentListingPage from '@/features/payments/components/payment-listing';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { isLocalAuthEnabled } from '@/lib/auth/local-auth-server';
import { searchParamsCache } from '@/lib/searchparams';
import { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';
import { getUserAccessContext, hasPermission } from '@/lib/auth/authorization';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Panel: Pagos'
};

type pageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: pageProps) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect('/iniciar-sesion');
  }
  if (!hasPermission(access, "payments.view")) {
    redirect('/panel');
  }

  if (isLocalAuthEnabled()) {
    return (
      <PageContainer
        scrollable={false}
        pageTitle='Pagos'
        pageDescription='Gestión y auditoría de ingresos (Libro Mayor).'
      >
        <LocalRuntimeModuleState
          moduleName="Pagos"
          summary="La vista de pagos aún no está migrada al runtime local. La página se mantiene visible con un estado controlado para que la aplicación no falle mientras se reemplaza la dependencia remota."
        />
      </PageContainer>
    );
  }

  const searchParams = await props.searchParams;
  // Allow nested RSCs to access the search params (in a type-safe way)
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      scrollable={false}
      pageTitle='Pagos'
      pageDescription='Gestión y auditoría de ingresos (Libro Mayor).'
    >
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={6} rowCount={8} filterCount={3} />
        }
      >
        <PaymentListingPage />
      </Suspense>
    </PageContainer>
  );
}
