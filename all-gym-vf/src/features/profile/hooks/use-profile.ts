'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { changePasswordWithLocalAuth, LocalAuthProxyError } from '@/lib/auth/client-auth';
import { getCurrentUser, updateProfile, ProfileData, UpdateProfileData } from '../actions/profile-actions';
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
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const result = await updateProfile(data);
      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar perfil');
      }
      return result;
    },
    onSuccess: async (result) => {
      if (result.data) {
        queryClient.setQueryData(profileKeys.current(), result.data);
      }
      queryClient.invalidateQueries({ queryKey: profileKeys.current() });
      router.refresh();
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
      await changePasswordWithLocalAuth({ currentPassword, newPassword });
    },
    onError: (error: Error) => {
      if (error instanceof LocalAuthProxyError && error.status === 401) {
        window.location.replace('/iniciar-sesion');
        return;
      }

      toast.error(error.message);
    },
  });
}
