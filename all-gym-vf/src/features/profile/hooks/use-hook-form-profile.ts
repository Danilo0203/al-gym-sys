"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, isValid } from "date-fns";
import { ProfileData } from "../actions/profile-actions";
import { useUpdatePassword, useUpdateProfile } from "./use-profile";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
  phone: z.string(),
  birth_date: z
    .date({ error: "La fecha de nacimiento es obligatoria" })
    .refine((value) => isValid(value), "La fecha de nacimiento no es válida"),
  gender: z.enum(["male", "female", "other"]),
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
      birth_date: profile.birth_date ? new Date(profile.birth_date) : undefined,
      gender: profile.gender || undefined,
    },
  });

  useEffect(() => {
    form.reset({
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      birth_date: profile.birth_date ? new Date(profile.birth_date) : undefined,
      gender: profile.gender || undefined,
    });
  }, [form, profile]);

  const onSubmit = async (values: ProfileFormValues) => {
    const nextValues = {
      full_name: values.full_name.trim(),
      phone: values.phone,
      birth_date: format(values.birth_date, "yyyy-MM-dd"),
      gender: values.gender,
    };

    const currentValues = {
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      birth_date: profile.birth_date || "",
      gender: profile.gender,
    };

    const payload = {
      ...(nextValues.full_name !== currentValues.full_name ? { full_name: nextValues.full_name } : {}),
      ...(nextValues.phone !== currentValues.phone ? { phone: nextValues.phone } : {}),
      ...(nextValues.birth_date !== currentValues.birth_date ? { birth_date: nextValues.birth_date } : {}),
      ...(nextValues.gender !== currentValues.gender ? { gender: nextValues.gender } : {}),
    };

    await updateProfile.mutateAsync(payload);
    form.reset({
      full_name: nextValues.full_name,
      phone: nextValues.phone,
      birth_date: values.birth_date,
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
