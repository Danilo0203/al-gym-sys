
import { notFound } from 'next/navigation';
import CustomerForm from './customer-form';
import { Customer } from './customer-tables/columns';
import { serverGetCustomerById } from '@/features/customers/lib/customer-server-api';

type TCustomerViewPageProps = {
  customerId: string;
};

export default async function CustomerViewPage({
  customerId
}: TCustomerViewPageProps) {
  let customer: Customer | null = null;
  let pageTitle = 'Crear Nuevo Cliente';

  if (customerId !== 'new') {
    try {
      const detail = await serverGetCustomerById(customerId);

      if (!detail) {
        notFound();
      }

      customer = detail as unknown as Customer;
      pageTitle = 'Editar Cliente';
    } catch (error) {
      console.error('Exception loading customer view page:', error);
      notFound();
    }
  }

  return <CustomerForm initialData={customer} pageTitle={pageTitle} />;
}
