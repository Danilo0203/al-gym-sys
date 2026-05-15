"use client";

import { useCurrentUser } from "@/features/profile/hooks/use-profile";
import { canAccessRoute, canPerformAction, isAdmin } from "@/lib/rbac";
import { UserRole } from "@/types";
import { ReactNode } from "react";

interface ProtectedProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface RouteProtectedProps extends ProtectedProps {
  route: string;
}

interface RoleProtectedProps extends ProtectedProps {
  allowedRoles: UserRole[];
}

interface ActionProtectedProps extends ProtectedProps {
  action: "create" | "read" | "update" | "delete";
  resource: "profiles" | "plans" | "payments" | "subscriptions" | "clients";
  resourceOwnerId?: string;
}

interface PermissionProtectedProps extends ProtectedProps {
  permissionKey: string;
}

/**
 * Protect content based on a specific permission key (or owner bypass)
 */
export function PermissionProtected({ permissionKey, children, fallback = null }: PermissionProtectedProps) {
  const { data: user } = useCurrentUser();
  const permissions = user?.permissions || [];
  const isOwner = user?.isOwner || false;

  if (isOwner || permissions.includes(permissionKey)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Protect content based on route access
 */
export function RouteProtected({ route, children, fallback = null }: RouteProtectedProps) {
  const { data: user } = useCurrentUser();
  const permissions = user?.permissions || [];
  const isOwner = user?.isOwner || false;

  if (!canAccessRoute(route, permissions, isOwner)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Protect content based on user role
 */
export function RoleProtected({ allowedRoles, children, fallback = null }: RoleProtectedProps) {
  const { data: user } = useCurrentUser();
  const userRole = (user?.role || "client") as UserRole;

  if (!allowedRoles.includes(userRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Protect content based on action permissions
 */
export function ActionProtected({
  action,
  resource,
  resourceOwnerId,
  children,
  fallback = null,
}: ActionProtectedProps) {
  const { data: user } = useCurrentUser();
  const userRole = (user?.role || "client") as UserRole;

  if (!canPerformAction(userRole, action, resource, resourceOwnerId, user?.id)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Show content only to admin users
 */
export function AdminOnly({ children, fallback = null }: ProtectedProps) {
  const { data: user } = useCurrentUser();
  const userRole = (user?.role || "client") as UserRole;
  const isOwner = user?.isOwner || false;

  if (!isAdmin(userRole) && !isOwner) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Show different content based on user role
 */
export function RoleSwitch({
  owner,
  admin,
  employee,
  trainer,
  client,
  fallback = null,
}: {
  owner?: ReactNode;
  admin?: ReactNode;
  employee?: ReactNode;
  trainer?: ReactNode;
  client?: ReactNode;
  fallback?: ReactNode;
}) {
  const { data: user } = useCurrentUser();
  const userRole = (user?.role || "client") as UserRole;

  switch (userRole) {
    case "owner":
      return <>{owner || fallback}</>;
    case "admin":
      return <>{admin || fallback}</>;
    case "employee":
      return <>{employee || fallback}</>;
    case "trainer":
      return <>{trainer || fallback}</>;
    case "client":
      return <>{client || fallback}</>;
    default:
      return <>{fallback}</>;
  }
}
