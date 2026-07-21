
import { notFound, redirect } from 'next/navigation';
import CustomerForm from './customer-form';
import type { ProfileFormData } from '../hooks/use-hook-form-customers';
import { serverGetCustomerById } from '@/features/customers/lib/customer-server-api';
import { CustomerApiError } from '@/features/customers/lib/local-customers';

type TCustomerViewPageProps = {
  customerId: string;
};

export default async function CustomerViewPage({
  customerId
}: TCustomerViewPageProps) {
  let customer: ProfileFormData | null = null;
  let pageTitle = 'Crear Nuevo Cliente';

  if (customerId !== 'new') {
    try {
      const detail = await serverGetCustomerById(customerId);

      if (!detail) {
        notFound();
      }

      customer = {
        id: detail.id,
        full_name: detail.full_name,
        phone: detail.phone,
        birth_date: detail.birth_date,
        gender: detail.gender,
        injuries: detail.injuries,
        medical_notes: detail.medical_notes,
      };
    } catch (error) {
      if (error instanceof CustomerApiError && error.status === 401) {
        redirect('/iniciar-sesion');
      }

      throw error;
    }

    pageTitle = 'Editar Cliente';
  }

  return <CustomerForm initialData={customer} pageTitle={pageTitle} />;
}
