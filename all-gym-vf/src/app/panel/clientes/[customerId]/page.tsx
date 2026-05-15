import FormCardSkeleton from '@/components/form-card-skeleton';
import PageContainer from '@/components/layout/page-container';
import { Suspense } from 'react';
import CustomerViewPage from '@/features/customers/components/customer-view-page';

export const metadata = {
  title: 'Panel: Vista del cliente'
};

type PageProps = { params: Promise<{ customerId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  return (
    <PageContainer scrollable>
      <div className='flex-1 space-y-4'>
        <Suspense fallback={<FormCardSkeleton />}>
          <CustomerViewPage customerId={params.customerId} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
