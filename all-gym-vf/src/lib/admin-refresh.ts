export type AdminRefreshScope = "users" | "roles";

const ADMIN_REFRESH_EVENT = "allgym-admin-refresh";

export function emitAdminRefresh(scope: AdminRefreshScope) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(ADMIN_REFRESH_EVENT, { detail: { scope } }));
}

export function subscribeAdminRefresh(scope: AdminRefreshScope, callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ scope?: AdminRefreshScope }>;
    if (customEvent.detail?.scope === scope) {
      callback();
    }
  };

  window.addEventListener(ADMIN_REFRESH_EVENT, handler);
  return () => window.removeEventListener(ADMIN_REFRESH_EVENT, handler);
}
