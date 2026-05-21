'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeGuatemalaPhoneForAuth } from '@/lib/auth/identifiers';

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

/**
 * Get the currently authenticated user's profile data
 */
export async function getCurrentUser(): Promise<{ success: boolean; data?: ProfileData; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const fallbackProfile: ProfileData = {
      id: user.id,
      email: user.email || null,
      full_name: user.user_metadata?.full_name || null,
      phone: null,
      birth_date: null,
      gender: null,
      avatar_url: user.user_metadata?.avatar_url || null,
      role: (user.user_metadata?.role as string | null) || user.role || 'authenticated',
      roleName: null,
      permissions: [],
      isOwner: false,
      created_at: user.created_at,
      updated_at: null,
    };

    // Get profile data from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching profile:', profileError);
      return {
        success: true,
        data: fallbackProfile,
      };
    }

    if (!profile) {
      return {
        success: true,
        data: fallbackProfile,
      };
    }

    // Fetch permissions
    let permissions: string[] = [];
    const { data: perms } = await supabase.rpc("get_current_permissions");
    if (perms) {
      permissions = perms as string[];
    }

    const roleSlug = (profile.role as string) || user.role || 'authenticated';

    let roleName: string | null = null;
    const adminClient = createAdminClient();
    const { data: roleRow } = await adminClient
      .from('roles')
      .select('name')
      .eq('slug', roleSlug)
      .maybeSingle();
    if (roleRow) {
      roleName = roleRow.name;
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email || null,
        full_name: profile.full_name,
        phone: profile.phone,
        birth_date: profile.birth_date,
        gender: profile.gender,
        avatar_url: profile.avatar_url || user.user_metadata?.avatar_url || null,
        role: roleSlug,
        roleName,
        permissions,
        isOwner: profile.role === 'owner',
        created_at: user.created_at,
        updated_at: profile.updated_at,
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
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

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
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return { success: false, error: `Error al actualizar: ${updateError.message}` };
    }

    // Also update auth user metadata for full_name
    if (data.full_name) {
      await supabase.auth.updateUser({
        data: { full_name: data.full_name }
      });
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
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const authCredentials = user.email
      ? { email: user.email, password: currentPassword }
      : user.phone
        ? { phone: normalizeGuatemalaPhoneForAuth(user.phone) || user.phone, password: currentPassword }
        : null;

    if (!authCredentials) {
      return { success: false, error: 'Tu cuenta no tiene un correo o teléfono configurado para validar la contraseña actual' };
    }

    // First verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword(authCredentials);

    if (signInError) {
      return { success: false, error: 'La contraseña actual es incorrecta' };
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('Error updating password:', updateError);
      return { success: false, error: `Error al cambiar contraseña: ${updateError.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updatePassword:', error);
    return { success: false, error: 'Error inesperado al cambiar contraseña' };
  }
}
