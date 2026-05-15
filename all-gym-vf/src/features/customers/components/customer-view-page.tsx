
import { notFound } from 'next/navigation';
import CustomerForm from './customer-form';
import { Customer } from './customer-tables/columns';
import { createClient } from '@/lib/supabase/server';

type TCustomerViewPageProps = {
  customerId: string;
};

export default async function CustomerViewPage({
  customerId
}: TCustomerViewPageProps) {
  let customer: Customer | null = null;
  let pageTitle = 'Crear Nuevo Cliente';

  if (customerId !== 'new') {
    const supabase = await createClient();
    const { data: customerData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', customerId)
        .single();
    
    customer = customerData as Customer;

    if (!customer) {
      notFound();
    }
    pageTitle = 'Editar Cliente';
  }

  return <CustomerForm initialData={customer} pageTitle={pageTitle} />;
}
