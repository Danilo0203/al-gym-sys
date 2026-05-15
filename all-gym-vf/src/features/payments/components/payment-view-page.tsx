import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import PaymentListingPage from './payment-listing';

export default function PaymentViewPage() {
  return (
    <div className='flex flex-1 flex-col space-y-4'>
      <div className='flex items-start justify-between'>
        <Heading
          title='Pagos'
          description='Gestión y auditoría de ingresos (Libro Mayor).'
        />
      </div>
      <Separator />
      <PaymentListingPage />
    </div>
  );
}
