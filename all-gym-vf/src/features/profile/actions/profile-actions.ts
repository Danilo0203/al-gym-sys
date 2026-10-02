'use server';

import { revalidatePath } from 'next/cache';

import { getServerAuthContext } from '@/lib/auth/server-auth';
import { LocalProfileError, getLocalProfile, updateLocalProfile } from '../server/local-profile';

export interface ProfileData {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: 'male' | 'female' | 'other' | null;
  avatar_url: string | null;
  role: string | null;
  roleName: string | null;
  permissions: string[];
  isOwner: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface UpdateProfileData {
  full_name?: string;
  phone?: string;
  birth_date?: string | null;
  gender?: 'male' | 'female' | 'other';
}

function profileErrorMessage(error: unknown): string {
  if (error instanceof LocalProfileError) return error.message;
  return 'Error inesperado al procesar el perfil';
}

function toProfileData(
  profile: Awaited<ReturnType<typeof getLocalProfile>>,
  authContext: NonNullable<Awaited<ReturnType<typeof getServerAuthContext>>>,
): ProfileData {
  if (!profile.created_at) {
    throw new LocalProfileError(502, 'INVALID_BACKEND_RESPONSE', 'El backend local devolvió un perfil inválido.');
  }

  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    phone: profile.phone,
    birth_date: profile.birth_date || null,
    gender: profile.gender,
    avatar_url: profile.avatar_url,
    role: profile.role ?? authContext.authorization.roleSlug,
    roleName: null,
    permissions: authContext.authorization.permissions,
    isOwner: authContext.authorization.isOwner,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

export async function getCurrentUser(): Promise<{ success: boolean; data?: ProfileData; error?: string }> {
  try {
    const authContext = await getServerAuthContext();
    if (!authContext) return { success: false, error: 'Usuario no autenticado' };

    return {
      success: true,
      data: toProfileData(await getLocalProfile(), authContext),
    };
  } catch (error) {
    console.error('Error loading local profile:', error instanceof LocalProfileError ? error.code : 'UNKNOWN');
    return { success: false, error: profileErrorMessage(error) };
  }
}

export async function updateProfile(
  data: UpdateProfileData,
): Promise<{ success: boolean; data?: ProfileData; error?: string }> {
  try {
    const authContext = await getServerAuthContext();
    if (!authContext) return { success: false, error: 'Usuario no autenticado' };

    const payload = {
      ...(data.full_name !== undefined ? { full_name: data.full_name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.birth_date !== undefined ? { birth_date: data.birth_date } : {}),
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
    };

    if (Object.keys(payload).length === 0) {
      return { success: false, error: 'No hay cambios para actualizar.' };
    }

    const profile = await updateLocalProfile(payload);
    revalidatePath('/panel/perfil');
    revalidatePath('/panel/perfil/[[...profile]]');

    return { success: true, data: toProfileData(profile, authContext) };
  } catch (error) {
    console.error('Error updating local profile:', error instanceof LocalProfileError ? error.code : 'UNKNOWN');
    return { success: false, error: profileErrorMessage(error) };
  }
}
