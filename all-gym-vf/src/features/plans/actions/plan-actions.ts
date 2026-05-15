'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserAccessContext, hasPermission } from '@/lib/auth/authorization';
import { revalidatePath } from 'next/cache';

export interface Plan {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  duration_days: number;
  is_active: boolean;
  created_at?: string;
}

export type CreatePlanData = Omit<Plan, 'id' | 'created_at'>;
export type UpdatePlanData = Partial<CreatePlanData>;

async function ensureAdmin(permission: string = "plans.view") {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    return { success: false, error: 'No autenticado' } as const;
  }
  if (!hasPermission(access, permission)) {
    return { success: false, error: 'No autorizado' } as const;
  }
  return null;
}

export async function getPlans(includeInactive = false) {
  const authError = await ensureAdmin();
  if (authError) {
    throw new Error(authError.error);
  }

  const supabase = await createClient();
  let query = supabase.from('plans').select('*').order('id', { ascending: true });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching plans:', error);
    throw new Error('No se pudieron cargar los planes');
  }

  return data as Plan[];
}

export async function getPlanById(id: number) {
  const authError = await ensureAdmin();
  if (authError) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching plan:', error);
    return null;
  }

  return data as Plan;
}

export async function createPlan(data: CreatePlanData) {
  const authError = await ensureAdmin("plans.create");
  if (authError) return authError;

  const supabase = await createClient();
  
  const { data: newPlan, error } = await supabase
    .from('plans')
    .insert([
      {
        name: data.name,
        description: data.description,
        price: data.price,
        duration_days: data.duration_days,
        is_active: data.is_active ?? true,
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating plan:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/panel/planes');
  return { success: true, data: newPlan };
}

export async function updatePlan(id: number, data: UpdatePlanData) {
  const authError = await ensureAdmin("plans.update");
  if (authError) return authError;

  const supabase = await createClient();
  const { error } = await supabase
    .from('plans')
    .update({
      name: data.name,
      description: data.description,
      price: data.price,
      duration_days: data.duration_days,
      is_active: data.is_active,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating plan:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/panel/planes');
  return { success: true };
}

export async function deletePlan(id: number) {
  const authError = await ensureAdmin("plans.delete");
  if (authError) return authError;

  const supabase = await createClient();
   
  // Realmente no borramos, solo desactivamos para preservar integridad referencial
  // Pero si el usuario explicitamente pide borrar, intentamos borrar.
  // Es mejor práctica hacer soft-delete (desactivar).
  // Por ahora implementaré delete real, si falla por FK, el frontend debería manejarlo.
  
  const { error } = await supabase
    .from('plans')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting plan:', error);
    // Si falla por FK, intentamos desactivar
    if (error.code === '23503') { // Foreign key violation
        const { error: updateError } = await supabase
            .from('plans')
            .update({ is_active: false })
            .eq('id', id);
            
        if (updateError) return { success: false, error: 'No se pudo eliminar ni desactivar el plan.' };
        
        revalidatePath('/panel/planes');
        return { success: true, message: 'Plan desactivado porque tiene clientes asociados.' };
    }
    return { success: false, error: error.message };
  }

  revalidatePath('/panel/planes');
  return { success: true };
}
