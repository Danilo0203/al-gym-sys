"use client";

import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconMail, IconCalendar, IconShieldCheck } from "@tabler/icons-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ProfileData } from "../actions/profile-actions";

interface ProfileViewPageProps {
  user: ProfileData;
}

export default function ProfileViewPage({ user }: ProfileViewPageProps) {
  // Get initials for avatar fallback
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const roleLabel = user.roleName || user.role || "Usuario";
  const userEmail = user.email || "Sin correo";
  const canChangePassword = Boolean(user.isOwner || user.role === "admin");

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-2 md:p-4">
      {/* Profile Header */}
      <Card className="border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent py-4 gap-4">
        <CardContent className="p-4">
          <div className="flex flex-col items-center gap-4 md:flex-row">
            {/* Avatar */}
            <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
              <AvatarImage src={user.avatar_url || ""} alt={user.full_name || "Usuario"} />
              <AvatarFallback className="bg-primary text-2xl font-bold text-primary-foreground">
                {getInitials(user.full_name)}
              </AvatarFallback>
            </Avatar>

            {/* User Info */}
            <div className="flex flex-1 flex-col items-center gap-1 text-center md:items-start md:text-left">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold">{user.full_name || "Usuario"}</h1>
                <Badge variant="secondary" className="font-normal h-5 px-2">
                  <IconShieldCheck className="mr-1 h-3 w-3" />
                  {roleLabel}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <IconMail className="h-3.5 w-3.5" />
                  {userEmail}
                </span>
                <span className="flex items-center gap-1">
                  <IconCalendar className="h-3.5 w-3.5" />
                  Miembro desde {format(new Date(user.created_at), "MMMM 'de' yyyy", { locale: es })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Profile Forms */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Personal Information Form */}
        <ProfileForm profile={user} />

        {/* Password Change Form */}
        {canChangePassword ? <PasswordForm /> : null}
      </div>

      {/* Account Information (Read-only) */}
      <Card className="py-4 gap-4">
        <CardHeader className="px-4 py-0">
          <CardTitle>Información de la Cuenta</CardTitle>
          <CardDescription>Información de tu cuenta que no puede ser modificada directamente.</CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Correo electrónico</p>
              <p className="font-medium text-sm">{userEmail}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">ID de Usuario</p>
              <p className="font-mono text-xs">{user.id}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Fecha de Registro</p>
              <p className="font-medium text-sm">
                {format(new Date(user.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Última Actualización</p>
              <p className="font-medium text-sm">
                {user.updated_at
                  ? format(new Date(user.updated_at), "d 'de' MMMM 'de' yyyy", { locale: es })
                  : "Sin actualizaciones"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
