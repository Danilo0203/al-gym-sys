import { getUserAccessContext } from "@/lib/auth/authorization";
import { isClientAccess } from "@/lib/auth/role-utils";
import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: 'Panel de administración',
  description: 'Panel principal de All Gym'
};

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect("/iniciar-sesion");
  }

  if (isClientAccess(access.roleScope, access.role)) {
    redirect("/mi/rutina");
  }

  // Persisting the sidebar state in the cookie.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"
  return (
    <KBar>
      <SidebarProvider defaultOpen={defaultOpen} className="h-svh overflow-hidden">
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <Header />
          {/* page main content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {children}
          </div>
          {/* page main content ends */}
        </SidebarInset>
      </SidebarProvider>
    </KBar>
  );
}
