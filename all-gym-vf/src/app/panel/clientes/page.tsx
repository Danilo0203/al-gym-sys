
import PageContainer from '@/components/layout/page-container';
import { LocalRuntimeModuleState } from '@/components/layout/local-runtime-module-state';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import CustomerListingPage from '@/features/customers/components/customer-listing';
import { CustomerFormSheet } from '@/features/customers/components/customer-form-sheet';
import { isLocalAuthEnabled } from '@/lib/auth/local-auth-server';
import { searchParamsCache } from '@/lib/searchparams';
import { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';
import { getUserAccessContext, hasPermission } from '@/lib/auth/authorization';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Panel: Clientes'
};

type pageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: pageProps) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) redirect('/iniciar-sesion');
  if (!hasPermission(access, "customers.view")) redirect('/panel');

  if (isLocalAuthEnabled()) {
    return (
      <PageContainer scrollable={false} pageTitle='Clientes' pageDescription='Administración de clientes'>
        <LocalRuntimeModuleState
          moduleName="Clientes"
          summary="Este módulo todavía depende de flujos remotos que no han sido migrados al backend local. Mientras se completa esa migración, la pantalla se deja en estado controlado para evitar errores de React o dependencias de Supabase en runtime."
        />
      </PageContainer>
    );
  }

  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      scrollable={false}
      pageTitle='Clientes'
      pageDescription='Administración de clientes'
      pageHeaderAction={hasPermission(access, "customers.create") ? <CustomerFormSheet /> : null}
    >
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={5} rowCount={8} filterCount={2} />
        }
      >
        <CustomerListingPage />
      </Suspense>
    </PageContainer>
  );
}
