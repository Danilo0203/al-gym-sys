'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserAccessContext, hasPermission } from '@/lib/auth/authorization';
import { getServerAuthContext } from '@/lib/auth/server-auth';
import { canEditOwnProfile, PROFILE_EDIT_PERMISSION_KEYS } from '../lib/profile-permissions';

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
  birth_date?: string | null;
  gender?: 'male' | 'female' | 'other';
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

    return {
      success: true,
      data: {
        id: authContext.user.id,
        email: authContext.user.email || null,
        full_name: authContext.user.profile.fullName || null,
        phone: null,
        birth_date: null,
        gender: null,
        avatar_url: null,
        role: authContext.authorization.roleSlug,
        roleName: null,
        permissions: authContext.authorization.permissions,
        isOwner: authContext.authorization.isOwner,
        created_at: null,
        updated_at: null,
      }
    };
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return { success: false, error: 'Error al obtener datos del usuario' };
  }
}

/**
 * Update the currently authenticated user's profile
 */
export async function updateProfile(data: UpdateProfileData): Promise<{ success: boolean; error?: string }> {
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

    const supabase = await createClient();

    // Prepare update data
    const updateData: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };

    if (data.full_name !== undefined) updateData.full_name = data.full_name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.birth_date !== undefined) updateData.birth_date = data.birth_date;
    if (data.gender !== undefined) updateData.gender = data.gender;

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', access.userId);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return { success: false, error: `Error al actualizar: ${updateError.message}` };
    }

    revalidatePath('/panel/perfil');
    return { success: true };
  } catch (error) {
    console.error('Error in updateProfile:', error);
    return { success: false, error: 'Error inesperado al actualizar perfil' };
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
