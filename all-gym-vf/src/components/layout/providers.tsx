'use client';
import React from 'react';
import { ActiveThemeProvider } from '../active-theme';
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import QueryProvider from '@/providers/query-provider';

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <ActiveThemeProvider initialTheme={activeThemeValue}>
        <QueryProvider>
          <ServiceWorkerRegistration />
          {children}
        </QueryProvider>
      </ActiveThemeProvider>
    </>
  );
}
