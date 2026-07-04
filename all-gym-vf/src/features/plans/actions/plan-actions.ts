'use server';
import { getPlansFromServer } from "@/features/customers/lib/local-memberships";

import { createClient } from '@/lib/supabase/server';
import { getUserAccessContext, hasPermission } from '@/lib/auth/authorization';
import { revalidatePath } from 'next/cache';

import type { Plan } from "@/features/customers/lib/local-memberships";
export type { Plan };

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

  const allPlans = await getPlansFromServer();
  
  if (!includeInactive) {
    return allPlans.filter(p => p.is_active);
  }
  
  return allPlans;
}

import { fetchAuthBackend } from "@/lib/auth/backend-auth";
import { cookies } from "next/headers";

async function getHeaders() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return headers;
}

export async function getPlanById(id: string) {
  const authError = await ensureAdmin();
  if (authError) {
    throw new Error(authError.error);
  }

  try {
    const response = await fetchAuthBackend(`/plans/${id}`, {
      method: "GET",
      headers: await getHeaders(),
    });

    if (!response.ok) {
      console.error('Error fetching plan:', response.statusText);
      return null;
    }

    const { data } = await response.json();
    return data as Plan;
  } catch (error) {
    console.error('Error fetching plan:', error);
    return null;
  }
}

export async function createPlan(data: CreatePlanData) {
  const authError = await ensureAdmin("plans.create");
  if (authError) return authError;

  try {
    const response = await fetchAuthBackend("/plans", {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      let errMsg = 'No se pudo crear el plan.';
      if (errData) {
        if (typeof errData.error === 'string') {
          errMsg = errData.error;
        } else if (typeof errData.error === 'object' && errData.error) {
          errMsg = errData.error.message || JSON.stringify(errData.error);
        } else if (typeof errData.message === 'string') {
          errMsg = errData.message;
        } else if (Array.isArray(errData.message)) {
          errMsg = errData.message.join(', ');
        } else {
          errMsg = JSON.stringify(errData);
        }
      } else {
        const text = await response.text();
        if (text) errMsg = text;
      }
      console.error('Error creating plan:', errMsg);
      return { success: false, error: errMsg };
    }

    revalidatePath('/panel/planes');
    return { success: true };
  } catch (error) {
    console.error('Error creating plan:', error);
    return { success: false, error: 'Error de conexión con el backend' };
  }
}

export async function updatePlan(id: string, data: UpdatePlanData) {
  const authError = await ensureAdmin("plans.update");
  if (authError) return authError;

  try {
    const response = await fetchAuthBackend(`/plans/${id}`, {
      method: "PUT",
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      let errMsg = 'No se pudo actualizar el plan.';
      if (errData) {
        if (typeof errData.error === 'string') {
          errMsg = errData.error;
        } else if (typeof errData.error === 'object' && errData.error) {
          errMsg = errData.error.message || JSON.stringify(errData.error);
        } else if (typeof errData.message === 'string') {
          errMsg = errData.message;
        } else if (Array.isArray(errData.message)) {
          errMsg = errData.message.join(', ');
        } else {
          errMsg = JSON.stringify(errData);
        }
      } else {
        const text = await response.text();
        if (text) errMsg = text;
      }
      console.error('Error updating plan:', errMsg);
      return { success: false, error: errMsg };
    }

    revalidatePath('/panel/planes');
    return { success: true };
  } catch (error) {
    console.error('Error updating plan:', error);
    return { success: false, error: 'Error de conexión con el backend' };
  }
}

export async function deletePlan(id: string) {
  const authError = await ensureAdmin("plans.delete");
  if (authError) return authError;

  try {
    const response = await fetchAuthBackend(`/plans/${id}`, {
      method: "DELETE",
      headers: await getHeaders(),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Error deleting plan:', errData);
      return { success: false, error: errData.error || 'No se pudo eliminar el plan.' };
    }

    revalidatePath('/panel/planes');
    return { success: true, message: 'Plan eliminado correctamente' };
  } catch (error) {
    console.error('Error deleting plan:', error);
    return { success: false, error: 'Error de conexión con el backend' };
  }
}
