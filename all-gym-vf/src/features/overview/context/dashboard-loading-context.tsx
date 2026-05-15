'use client';

import { createContext, useContext, useTransition, ReactNode } from 'react';

interface DashboardLoadingContextType {
  isLoading: boolean;
  startTransition: (callback: () => void) => void;
}

const DashboardLoadingContext = createContext<DashboardLoadingContextType | undefined>(undefined);

export function DashboardLoadingProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  
  return (
    <DashboardLoadingContext.Provider value={{ isLoading: isPending, startTransition }}>
      {children}
    </DashboardLoadingContext.Provider>
  );
}

export function useDashboardLoading() {
  const context = useContext(DashboardLoadingContext);
  if (!context) {
    throw new Error('useDashboardLoading must be used within a DashboardLoadingProvider');
  }
  return context;
}
