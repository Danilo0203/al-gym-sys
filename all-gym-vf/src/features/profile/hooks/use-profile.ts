'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, updateProfile, updatePassword, ProfileData, UpdateProfileData } from '../actions/profile-actions';
import { toast } from 'sonner';

// Query keys
export const profileKeys = {
  all: ['profile'] as const,
  current: () => [...profileKeys.all, 'current'] as const,
};

/**
 * Hook to get the current authenticated user's profile
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: profileKeys.current(),
    queryFn: async () => {
      const result = await getCurrentUser();
      if (!result.success) {
        throw new Error(result.error || 'Error al obtener usuario');
      }
      return result.data as ProfileData;
    },
    staleTime: 0,
    retry: 1,
  });
}

/**
 * Hook to update the current user's profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const result = await updateProfile(data);
      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar perfil');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.current() });
      toast.success('Perfil actualizado correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Hook to update the user's password
 */
export function useUpdatePassword() {
  return useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const result = await updatePassword(currentPassword, newPassword);
      if (!result.success) {
        throw new Error(result.error || 'Error al cambiar contraseña');
      }
      return result;
    },
    onSuccess: () => {
      toast.success('Contraseña actualizada correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
