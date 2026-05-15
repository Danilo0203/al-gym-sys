import { NavItem } from "@/types";

/**
 * Navigation configuration with RBAC support
 *
 * This configuration is used for both the sidebar navigation and Cmd+K bar.
 *
 * Access control:
 * - `role`: legacy role-based filtering (still supported for backward compat)
 * - `permissions`: array of permission keys required (matches against user.permissions)
 *
 * Note: Owner bypasses all checks.
 */
export const navItems: NavItem[] = [
  {
    title: "Tablero",
    url: "/panel/resumen",
    icon: "dashboard",
    isActive: false,
    shortcut: ["d", "d"],
    access: { permissions: ["dashboard.view"] },
    items: [],
  },
  {
    title: "Clientes",
    url: "/panel/clientes",
    icon: "customers",
    isActive: false,
    access: { permissions: ["customers.view"] },
    items: [],
  },
  {
    title: "Pagos",
    url: "/panel/pagos",
    icon: "billing",
    isActive: false,
    access: { permissions: ["payments.view"] },
    items: [],
  },
  {
    title: "Caja",
    url: "#",
    icon: "cash",
    isActive: false,
    access: { permissions: ["cash.view"] },
    items: [
      {
        title: "Caja actual",
        url: "/panel/caja",
        icon: "cash",
      },
      {
        title: "Historial",
        url: "/panel/caja/historial",
        icon: "cash",
      },
    ],
  },
  {
    title: "Inventario",
    url: "#",
    icon: "inventory",
    isActive: false,
    access: { permissions: ["products.view", "inventory.view"] },
    items: [
      {
        title: "Productos",
        url: "/panel/inventario/productos",
        icon: "product",
        access: { permissions: ["products.view"] },
      },
      {
        title: "Movimientos",
        url: "/panel/inventario/movimientos",
        icon: "inventory",
        access: { permissions: ["inventory.view"] },
      },
    ],
  },
  {
    title: "Administración",
    url: "#",
    icon: "settings",
    isActive: true,
    access: { permissions: ["users.view", "plans.view", "attendance.view", "routines.view", "exercises.view", "roles.view", "messages.view"] },
    items: [
      {
        title: "Usuarios",
        url: "/panel/usuarios",
        icon: "teams",
        access: { permissions: ["users.view"] },
      },
      {
        title: "Planes",
        url: "/panel/planes",
        icon: "billing",
        access: { permissions: ["plans.view"] },
      },
      {
        title: "Asistencias",
        url: "/panel/asistencias",
        icon: "dashboard",
        access: { permissions: ["attendance.view"] },
      },
      {
        title: "Rutinas",
        url: "/panel/rutinas",
        icon: "routine",
        access: { permissions: ["routines.view"] },
      },
      {
        title: "Ejercicios",
        url: "/panel/ejercicios",
        icon: "product",
        access: { permissions: ["exercises.view"] },
      },
      {
        title: "Roles",
        url: "/panel/roles",
        icon: "settings",
        access: { permissions: ["roles.view"] },
      },
      {
        title: "Mensajes",
        url: "/panel/mensajes",
        icon: "message",
        access: { permissions: ["messages.view"] },
      },
    ],
  },
  {
    title: "Cuenta",
    url: "#",
    icon: "account",
    isActive: true,
    access: { permissions: ["profile.view"] },
    items: [
      {
        title: "Perfil",
        url: "/panel/perfil",
        icon: "profile",
        shortcut: ["m", "m"],
      },
    ],
  },
];
