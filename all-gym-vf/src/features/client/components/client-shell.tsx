"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCreditCard, IconUserCircle, IconBarbell, IconWifi, IconWifiOff } from "@tabler/icons-react";
import { ModeToggle } from "@/components/layout/ThemeToggle/theme-toggle";
import { Button } from "@/components/ui/button";
import { ClientSignOutButton } from "@/features/client/components/client-sign-out-button";
import { useOnlineStatus } from "@/features/client/hooks/use-online-status";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/mi/rutina",
    label: "Rutina",
    icon: IconBarbell,
  },
  {
    href: "/mi/membresia",
    label: "Membresía",
    icon: IconCreditCard,
  },
  {
    href: "/mi/perfil",
    label: "Perfil",
    icon: IconUserCircle,
  },
];

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOnline = useOnlineStatus();
  const activeItem = NAV_ITEMS.find((item) => pathname === item.href) ?? NAV_ITEMS[0];

  return (
    <div className="h-svh overflow-y-auto overscroll-y-contain bg-muted/40 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
      <div className="mx-auto flex min-h-svh max-w-4xl flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <IconBarbell className="size-7 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-tight">ALL GYM</p>
                <h1 className="truncate text-xs text-muted-foreground">Mi {activeItem.label.toLowerCase()}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs sm:inline-flex",
                  isOnline
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                )}
              >
                {isOnline ? <IconWifi className="h-3.5 w-3.5" /> : <IconWifiOff className="h-3.5 w-3.5" />}
                {isOnline ? "Conectado" : "Sin conexión"}
              </span>
              <ModeToggle />
              <ClientSignOutButton />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">{children}</main>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
          <div className="pointer-events-auto mx-auto max-w-4xl border-t border-border bg-background/95 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] backdrop-blur">
            <nav className="grid grid-cols-3 gap-2" aria-label="Mi espacio">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Button
                    key={item.href}
                    asChild
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "h-12 flex-col gap-1 rounded-xl transition-colors",
                    )}
                  >
                    <Link href={item.href} aria-current={isActive ? "page" : undefined}>
                      <Icon className="h-4 w-4" />
                      <span className="text-[11px]">{item.label}</span>
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
