"use client";

import { useEffect, useState, useRef } from "react";
import { CustomerList } from "./customer-list";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import type { CustomerListItem } from "./customer-list";

interface MasterDetailLayoutProps {
  children: React.ReactNode;
  initialCustomers: CustomerListItem[];
}

export function MasterDetailLayout({ children, initialCustomers }: MasterDetailLayoutProps) {
  const { setOpen, isMobile } = useSidebar();
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const hasCollapsedOnMount = useRef(false);

  // Collapse main sidebar on mount to maximize focus on customer details
  // Using a ref to ensure this only happens once per mount
  useEffect(() => {
    if (!isMobile && !hasCollapsedOnMount.current) {
      setOpen(false);
      hasCollapsedOnMount.current = true;
    }
  }, [setOpen, isMobile]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Sidebar List Panel */}
      <div
        className={cn(
          "relative flex-shrink-0 transition-all duration-300 ease-in-out border-r bg-card",
          isListCollapsed ? "w-0 overflow-hidden" : "w-[320px] lg:w-[380px]",
        )}
      >
        <CustomerList initialCustomers={initialCustomers} />
      </div>

      {/* Main Content (Detail View) */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">{children}</div>

      {/* Toggle Button for Layout Sidebar - Moved outside to prevent clipping */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-50 transition-[left] duration-300 ease-in-out",
          isListCollapsed ? "left-0" : "left-[320px] lg:left-[380px]",
        )}
      >
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full shadow-md border -translate-x-1/2"
          onClick={() => setIsListCollapsed(!isListCollapsed)}
          style={isListCollapsed ? { marginLeft: "24px" } : undefined}
        >
          {isListCollapsed ? <IconChevronRight className="h-4 w-4" /> : <IconChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
