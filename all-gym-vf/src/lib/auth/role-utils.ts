import type { UserRole } from "@/types";
import { canAccessRoute, getFirstAccessiblePanelRoute } from "@/lib/rbac";

export const VALID_USER_ROLES = ["owner", "admin", "trainer", "employee", "client"] as const satisfies readonly UserRole[];
export const INTERNAL_USER_ROLES = ["owner", "admin", "trainer", "employee"] as const satisfies readonly Exclude<
  UserRole,
  "client"
>[];
export const DEFAULT_PANEL_ROUTE = "/panel/resumen";
export const DEFAULT_CLIENT_ROUTE = "/mi/rutina";

export function parseUserRole(value: unknown): UserRole | null {
  if (typeof value !== "string") return null;
  return VALID_USER_ROLES.includes(value as UserRole) ? (value as UserRole) : null;
}

export function isClientRole(role: UserRole | null | undefined): role is "client" {
  return role === "client";
}

export function isInternalRole(role: UserRole | null | undefined): role is Exclude<UserRole, "client"> {
  return INTERNAL_USER_ROLES.includes(role as Exclude<UserRole, "client">);
}

export function isPanelScope(scope: string | null | undefined): scope is "panel" {
  return scope === "panel";
}

export function isClientScope(scope: string | null | undefined): scope is "client" {
  return scope === "client";
}

export function isClientAccess(roleScope: string | null | undefined, role: UserRole | null | undefined) {
  return isClientScope(roleScope) || (!roleScope && isClientRole(role));
}

export function getDefaultRouteForAccess(
  roleScope: string | null | undefined,
  role: UserRole | null | undefined,
  permissions: string[] = [],
  isOwner = false,
) {
  if (isClientAccess(roleScope, role)) return DEFAULT_CLIENT_ROUTE;

  const defaultPanelRoute = getFirstAccessiblePanelRoute(permissions, isOwner);
  if (isPanelScope(roleScope)) return defaultPanelRoute || DEFAULT_PANEL_ROUTE;
  return defaultPanelRoute || DEFAULT_PANEL_ROUTE;
}

export function getDefaultRouteForRole(role: UserRole | null | undefined, permissions: string[] = [], isOwner = false) {
  return getDefaultRouteForAccess(null, role, permissions, isOwner);
}

function normalizeRequestedPath(requestedPath: string | null | undefined) {
  if (typeof requestedPath !== "string") return null;

  const trimmedPath = requestedPath.trim();
  if (!trimmedPath.startsWith("/") || trimmedPath.startsWith("//")) {
    return null;
  }

  const parsedUrl = new URL(trimmedPath, "https://allgym.local");
  return {
    pathname: parsedUrl.pathname,
    suffix: `${parsedUrl.search}${parsedUrl.hash}`,
  };
}

export function resolvePostLoginRoute({
  role,
  roleScope,
  permissions = [],
  isOwner = false,
  requestedPath,
}: {
  role: UserRole | null | undefined;
  roleScope: string | null | undefined;
  permissions?: string[];
  isOwner?: boolean;
  requestedPath?: string | null | undefined;
}) {
  const defaultRoute = getDefaultRouteForAccess(roleScope, role, permissions, isOwner);
  const normalizedPath = normalizeRequestedPath(requestedPath);

  if (!normalizedPath) {
    return defaultRoute;
  }

  const { pathname, suffix } = normalizedPath;
  const hasClientAccess = isClientAccess(roleScope, role);

  if (pathname === "/") {
    return defaultRoute;
  }

  if (pathname === "/mi") {
    return hasClientAccess ? `${DEFAULT_CLIENT_ROUTE}${suffix}` : DEFAULT_PANEL_ROUTE;
  }

  if (pathname.startsWith("/mi/")) {
    return hasClientAccess ? `${pathname}${suffix}` : DEFAULT_PANEL_ROUTE;
  }

  if (pathname === "/panel") {
    return hasClientAccess ? DEFAULT_CLIENT_ROUTE : `${defaultRoute}${suffix}`;
  }

  if (pathname.startsWith("/panel/")) {
    if (hasClientAccess) {
      return DEFAULT_CLIENT_ROUTE;
    }

    return canAccessRoute(pathname, permissions, isOwner) ? `${pathname}${suffix}` : defaultRoute;
  }

  return `${pathname}${suffix}`;
}
