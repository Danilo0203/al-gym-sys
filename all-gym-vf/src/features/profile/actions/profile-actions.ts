'use server';

import { revalidatePath } from 'next/cache';
import { getUserAccessContext, hasPermission } from '@/lib/auth/authorization';
import { getServerAuthContext } from '@/lib/auth/server-auth';
import { canEditOwnProfile, PROFILE_EDIT_PERMISSION_KEYS } from '../lib/profile-permissions';
import { LocalProfileHttpError, getLocalProfile, updateLocalProfile } from '../server/local-profile';

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
  created_at: string | null;
  updated_at: string | null;
}

export interface UpdateProfileData {
  full_name?: string;
  phone?: string;
  birth_date?: string;
  gender?: 'male' | 'female' | 'other';
}

function mapProfileBackendError(error: unknown): string {
  if (error instanceof LocalProfileHttpError) {
    switch (error.status) {
      case 400:
        return error.message || 'Datos inválidos para actualizar el perfil.';
      case 401:
        return 'Sesión inválida. Inicia sesión nuevamente.';
      case 403:
        return 'No tienes permiso para editar este perfil.';
      case 404:
        return 'Perfil no encontrado.';
      default:
        return error.message || `Error del backend local (${error.status}).`;
    }
  }

  if (error instanceof Error && error.message.startsWith('Could not reach local profile backend:')) {
    return 'No fue posible conectar con el backend local del perfil.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Error inesperado al procesar el perfil.';
}

/**
 * Get the currently authenticated user's profile data
 */
export async function getCurrentUser(): Promise<{ success: boolean; data?: ProfileData; error?: string }> {
  try {
    const authContext = await getServerAuthContext();

    if (!authContext) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const profile = await getLocalProfile();

    return {
      success: true,
      data: {
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
      }
    };
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return { success: false, error: mapProfileBackendError(error) };
  }
}

/**
 * Update the currently authenticated user's profile
 */
export async function updateProfile(
  data: UpdateProfileData,
): Promise<{ success: boolean; data?: ProfileData; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) {
      return { success: false, error: 'Usuario no autenticado' };
    }
    if (
      !canEditOwnProfile(access.permissions, access.isOwner) &&
      !PROFILE_EDIT_PERMISSION_KEYS.some((permission) => hasPermission(access, permission))
    ) {
      return { success: false, error: 'No autorizado para editar perfil' };
    }

    if (!access.userId) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    if (Object.keys(data).length === 0) {
      return { success: false, error: 'No hay cambios para actualizar.' };
    }

    const authContext = await getServerAuthContext();
    if (!authContext) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const updatedProfile = await updateLocalProfile(data);

    revalidatePath('/panel/perfil');
    revalidatePath('/panel/perfil/[[...profile]]');

    return {
      success: true,
      data: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        full_name: updatedProfile.full_name,
        phone: updatedProfile.phone,
        birth_date: updatedProfile.birth_date || null,
        gender: updatedProfile.gender,
        avatar_url: updatedProfile.avatar_url,
        role: updatedProfile.role ?? authContext.authorization.roleSlug,
        roleName: null,
        permissions: authContext.authorization.permissions,
        isOwner: authContext.authorization.isOwner,
        created_at: updatedProfile.created_at,
        updated_at: updatedProfile.updated_at,
      },
    };
  } catch (error) {
    console.error('Error in updateProfile:', error);
    return { success: false, error: mapProfileBackendError(error) };
  }
}

/**
 * Update the user's password
 */
export async function updatePassword(
  _currentPassword: string,
  _newPassword: string
): Promise<{ success: boolean; error?: string }> {
  void _currentPassword;
  void _newPassword;

  return {
    success: false,
    error: 'El cambio de contraseña quedó deshabilitado mientras la autenticación use el backend local.',
  };
}
