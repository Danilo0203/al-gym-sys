import { useMemo } from "react";
import type { NavItem, UserRole } from "@/types";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";

export function useFilteredNavItems(items: NavItem[]) {
  const { data: user } = useCurrentUser();

  const accessContext = useMemo(() => {
    return {
      role: (user?.role || "client") as UserRole,
      isAuthenticated: !!user,
      isOwner: user?.isOwner || false,
      permissions: user?.permissions || [],
    };
  }, [user]);

  const filteredItems = useMemo(() => {
    if (!accessContext.isAuthenticated) return [];

    function checkAccess(access: NavItem["access"]): boolean {
      if (!access) return true;

      // Owner bypasses all checks
      if (accessContext.isOwner) return true;

      // Check permissions (priority)
      if (access.permissions && access.permissions.length > 0) {
        const hasAny = access.permissions.some((p) => accessContext.permissions.includes(p));
        if (!hasAny) return false;
      }

      // Check role (legacy)
      if (access.role) {
        const requiredRoles = Array.isArray(access.role) ? access.role : [access.role];
        if (!requiredRoles.includes(accessContext.role)) {
          return false;
        }
      }

      return true;
    }

    return items
      .filter((item) => checkAccess(item.access))
      .map((item) => {
        if (item.items && item.items.length > 0) {
          const filteredChildren = item.items.filter((child) => checkAccess(child.access));
          if (filteredChildren.length === 0) return null;
          return {
            ...item,
            items: filteredChildren,
          };
        }
        return item;
      })
      .filter((item): item is NavItem => item !== null);
  }, [items, accessContext]);

  return filteredItems;
}
