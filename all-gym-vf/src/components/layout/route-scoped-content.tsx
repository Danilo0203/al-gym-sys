"use client";

import React from "react";
import { usePathname } from "next/navigation";

export function RouteScopedContent({
  scope,
  children,
}: {
  scope: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return <React.Fragment key={`${scope}:${pathname}`}>{children}</React.Fragment>;
}
