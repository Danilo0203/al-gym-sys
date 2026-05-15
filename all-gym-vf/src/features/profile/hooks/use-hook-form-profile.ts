"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ProfileData } from "../actions/profile-actions";
import { useUpdatePassword, useUpdateProfile } from "./use-profile";

const profileSchema = z.object({
  full_name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  phone: z.string().optional().or(z.literal("")),
  birth_date: z.date().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "La contraseña actual es requerida"),
    newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirma tu nueva contraseña"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type ProfileFormValues = z.infer<typeof profileSchema>;
export type PasswordFormValues = z.infer<typeof passwordSchema>;

export function useHookFormProfile(profile: ProfileData) {
  const updateProfile = useUpdateProfile();
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      birth_date: profile.birth_date ? new Date(profile.birth_date) : null,
      gender: profile.gender || undefined,
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    await updateProfile.mutateAsync({
      full_name: values.full_name,
      phone: values.phone || undefined,
      birth_date: values.birth_date ? values.birth_date.toISOString().split("T")[0] : null,
      gender: values.gender,
    });
  };

  return {
    form,
    isPending: updateProfile.isPending,
    onSubmit,
  };
}

export function useHookFormPassword() {
  const updatePassword = useUpdatePassword();
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    await updatePassword.mutateAsync({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    form.reset();
  };

  return {
    form,
    isPending: updatePassword.isPending,
    onSubmit,
  };
}
