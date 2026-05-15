'use client';

// import { useAuth, useOrganizationList } from '@clerk/nextjs';
import { Dumbbell } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar';

interface MockOrganization {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  hasImage: boolean;
}

interface MockMembership {
  id: string;
  organization: MockOrganization;
  role: string;
}

export function OrgSwitcher() {
  const { state } = useSidebar();

  // Mock data for replacement
  const isLoaded = true;
  const orgId = "org_1";
  const userMemberships = {
    data: [
       {
         id: "mem_1",
         organization: {
            id: "org_1",
            name: "AllGym",
            slug: "allgym",
            imageUrl: "",
            hasImage: false
         },
         role: "admin"
       }
    ] satisfies MockMembership[]
  };


  /*
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
      keepPreviousData: false
    }
  });

  const { orgId } = useAuth();
  */


  // Get the currently active organization
  const activeOrganization = userMemberships?.data?.find(
    (membership) => membership.organization.id === orgId
  )?.organization;

  // Show loading state
  if (!isLoaded) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size='lg' disabled>
            <div className='flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white'>
              <Dumbbell className='size-4' />
            </div>
            <div
              className={`grid flex-1 text-left text-sm leading-tight transition-all duration-200 ease-in-out ${
                state === 'collapsed'
                  ? 'invisible max-w-0 overflow-hidden opacity-0'
                  : 'visible max-w-full opacity-100'
              }`}
            >
              <span className='truncate font-medium'>Cargando...</span>
              <span className='text-muted-foreground truncate text-xs'>
                Organizaciones
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // Show create organization option if no organizations
  if (!userMemberships?.data || userMemberships.data.length === 0) {
    return null;
  }

  // Use active organization or first organization as fallback
  const displayOrganization =
    activeOrganization || userMemberships.data[0]?.organization;

  if (!displayOrganization) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className='cursor-default data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
        >
          <div className='flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white'>
            <Dumbbell className='size-4' />
          </div>
          <div
            className={`grid flex-1 text-left text-sm leading-tight transition-all duration-200 ease-in-out ${
              state === 'collapsed'
                ? 'invisible max-w-0 overflow-hidden opacity-0'
                : 'visible max-w-full opacity-100'
            }`}
          >
            <span className='truncate font-medium'>AllGym</span>
            <span className='text-muted-foreground truncate text-xs'>
              {userMemberships.data.find(
                (m) => m.organization.id === displayOrganization.id
              )?.role || 'Organización'}
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
