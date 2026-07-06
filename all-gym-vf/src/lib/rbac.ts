import { UserRole } from "@/types";

/**
 * Role-based access control utilities
 *
 * These utilities help enforce RBAC on the client side.
 * Note: These are NOT a security measure - they only improve UX.
 * Real security is enforced by:
 * 1. Middleware (src/proxy.ts)
 * 2. getUserAccessContext with permission checks in server actions
 * 3. RLS policies in Supabase
 */

// Map routes to required permissions (replaces old ROUTE_PERMISSIONS role arrays)
export const ROUTE_PERMISSIONS: Record<string, string> = {
  "/panel/resumen": "dashboard.view",
  "/panel/usuarios": "users.view",
  "/panel/clientes": "customers.view",
  "/panel/planes": "plans.view",
  "/panel/pagos": "payments.view",
  "/panel/caja": "cash.view",
  "/panel/caja/historial": "cash.view",
  "/panel/inventario": "inventory.view",
  "/panel/inventario/productos": "products.view",
  "/panel/inventario/movimientos": "inventory.view",
  "/panel/asistencias": "attendance.view",
  "/panel/rutinas": "routines.view",
  "/panel/ejercicios": "exercises.view",
  "/panel/roles": "roles.view",
  "/panel/mensajes": "messages.view",
  "/panel/perfil": "profile.view",
  "/mi/rutina": "",
  "/mi/perfil": "",
  "/mi/membresia": "",
};

const PANEL_ROUTE_PRIORITY = [
  "/panel/clientes",
  "/panel/resumen",
  "/panel/pagos",
  "/panel/caja",
  "/panel/caja/historial",
  "/panel/inventario/productos",
  "/panel/inventario/movimientos",
  "/panel/asistencias",
  "/panel/rutinas",
  "/panel/ejercicios",
  "/panel/usuarios",
  "/panel/planes",
  "/panel/roles",
  "/panel/mensajes",
  "/panel/perfil",
] as const;

function matchesRoutePattern(route: string, candidate: string) {
  return route === candidate || route.startsWith(`${candidate}/`);
}

export function getRequiredPermissionForRoute(route: string): string | null {
  const normalizedRoute = route.split("?")[0]?.split("#")[0] || route;
  const matchingRoute = Object.keys(ROUTE_PERMISSIONS)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => matchesRoutePattern(normalizedRoute, candidate));

  if (!matchingRoute) return null;

  return ROUTE_PERMISSIONS[matchingRoute] || null;
}

/**
 * Check if a user has access to a route based on permissions
 */
export function canAccessRoute(route: string, permissions: string[], isOwner: boolean): boolean {
  if (isOwner) return true;

  const requiredPermission = getRequiredPermissionForRoute(route);
  if (!requiredPermission) {
    // Routes without a permission requirement default to allowed (like /mi)
    return true;
  }

  return permissions.includes(requiredPermission);
}

/**
 * Check if a user is an admin
 */
export function isAdmin(userRole: UserRole): boolean {
  return userRole === "admin";
}

/**
 * Check if a user is owner
 */
export function isOwner(userRole: UserRole): boolean {
  return userRole === "owner";
}

/**
 * Check if a user is an employee
 */
export function isEmployee(userRole: UserRole): boolean {
  return userRole === "employee";
}

/**
 * Check if a user is a trainer
 */
export function isTrainer(userRole: UserRole): boolean {
  return userRole === "trainer";
}

/**
 * Check if a user is a client
 */
export function isClient(userRole: UserRole): boolean {
  return userRole === "client";
}

/**
 * Check if the user has a specific permission (or is owner)
 */
export function hasPermission(permissions: string[], isOwner: boolean, permissionKey: string): boolean {
  if (isOwner) return true;
  return permissions.includes(permissionKey);
}

/**
 * Get all routes accessible by a user based on permissions
 */
export function getAccessibleRoutes(permissions: string[], isOwner: boolean): string[] {
  if (isOwner) {
    return Object.keys(ROUTE_PERMISSIONS);
  }
  return Object.entries(ROUTE_PERMISSIONS)
    .filter(([, perm]) => !perm || permissions.includes(perm))
    .map(([route]) => route);
}

export function getFirstAccessiblePanelRoute(permissions: string[], isOwner: boolean): string | null {
  if (isOwner) return PANEL_ROUTE_PRIORITY[0];

  return PANEL_ROUTE_PRIORITY.find((route) => canAccessRoute(route, permissions, isOwner)) ?? null;
}

/**
 * Check if a user can perform an action on a resource
 */
export function canPerformAction(
  userRole: UserRole,
  action: "create" | "read" | "update" | "delete",
  resource: "profiles" | "plans" | "payments" | "subscriptions" | "clients",
  resourceOwnerId?: string,
  userId?: string,
): boolean {
  // Owner can do everything
  if (isOwner(userRole)) {
    return true;
  }

  // Admin can do everything
  if (isAdmin(userRole)) {
    return true;
  }

  switch (resource) {
    case "profiles":
      if (action === "read" || action === "update") {
        return resourceOwnerId === userId;
      }
      return false;

    case "plans":
      if (action === "read") {
        return true;
      }
      return false;

    case "payments":
      if (action === "read") {
        return resourceOwnerId === userId;
      }
      return false;

    case "subscriptions":
      if (action === "read") {
        return resourceOwnerId === userId;
      }
      return false;

    case "clients":
      if (action === "read") {
        return resourceOwnerId === userId;
      }
      return false;

    default:
      return false;
  }
}

/**
 * Get a user-friendly error message for unauthorized access
 */
export function getUnauthorizedMessage(userRole: UserRole): string {
  return `No tienes permisos para acceder a esta página. Tu rol actual es "${userRole}". Contacta a un administrador si crees que esto es un error.`;
}

/**
 * Role hierarchy for comparison
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 5,
  admin: 4,
  trainer: 3,
  employee: 2,
  client: 1,
};

export function hasRoleOrHigher(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
