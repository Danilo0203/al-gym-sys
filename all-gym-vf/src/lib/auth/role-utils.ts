import type { UserRole } from "@/types";

export const VALID_USER_ROLES: UserRole[] = ["owner", "admin", "trainer", "employee", "client"];
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
  return role === "owner" || role === "admin" || role === "trainer" || role === "employee";
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

export function getDefaultRouteForAccess(roleScope: string | null | undefined, role: UserRole | null | undefined) {
  if (isClientAccess(roleScope, role)) return DEFAULT_CLIENT_ROUTE;
  if (isPanelScope(roleScope)) return DEFAULT_PANEL_ROUTE;
  return DEFAULT_PANEL_ROUTE;
}

export function getDefaultRouteForRole(role: UserRole | null | undefined) {
  return getDefaultRouteForAccess(null, role);
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
  requestedPath,
}: {
  role: UserRole | null | undefined;
  roleScope: string | null | undefined;
  requestedPath?: string | null | undefined;
}) {
  const defaultRoute = getDefaultRouteForAccess(roleScope, role);
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
    return hasClientAccess ? DEFAULT_CLIENT_ROUTE : `${DEFAULT_PANEL_ROUTE}${suffix}`;
  }

  if (pathname.startsWith("/panel/")) {
    return hasClientAccess ? DEFAULT_CLIENT_ROUTE : `${pathname}${suffix}`;
  }

  return `${pathname}${suffix}`;
}
