"use client";

import { useDeferredValue, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconLoader2, IconSearch } from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCustomerSidebar } from "@/features/customers/lib/customer-api";
import type { CustomerSidebarResponse } from "@/features/customers/lib/local-customers";
import { cn } from "@/lib/utils";

export type CustomerListItem = CustomerSidebarResponse["data"][number];

interface CustomerListProps {
  initialCustomers: CustomerListItem[];
}

export function CustomerList({ initialCustomers }: CustomerListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<CustomerListItem[]>(initialCustomers);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const params = useParams();
  const deferredSearchTerm = useDeferredValue(searchTerm.trim());
  const currentCustomerId = params?.customerId as string;

  useEffect(() => {
    let cancelled = false;

    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const payload = await getCustomerSidebar(deferredSearchTerm, 24);
        if (!cancelled) setResults(payload.data);
      } catch (fetchError) {
        if (!cancelled) {
          setResults([]);
          setError(fetchError instanceof Error ? fetchError.message : "No se pudieron cargar los clientes.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, deferredSearchTerm ? 300 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [deferredSearchTerm, retryKey]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-[300px] max-w-sm flex-col overflow-hidden border-r bg-muted/10">
      <div className="shrink-0 space-y-4 border-b p-4">
        <h2 className="px-2 text-lg font-semibold">Clientes</h2>
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="pl-9"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setIsLoading(true);
              setError(null);
            }}
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <div className="flex min-w-0 flex-col gap-1 p-2">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              Cargando clientes...
            </div>
          ) : null}

          {!isLoading && error ? (
            <div className="space-y-3 p-4 text-center text-sm text-destructive">
              <p>{error}</p>
              <Button size="sm" variant="outline" onClick={() => {
                setIsLoading(true);
                setRetryKey((value) => value + 1);
              }}>
                Reintentar
              </Button>
            </div>
          ) : null}

          {!isLoading && !error && results.map((customer) => {
            const initials = customer.full_name.split(" ").map((name) => name[0]).join("").slice(0, 2).toUpperCase();
            const isSelected = customer.id === currentCustomerId;

            return (
              <Link
                key={customer.id}
                href={`/panel/clientes/${customer.id}/history`}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50",
                  isSelected && "bg-muted shadow-sm",
                )}
              >
                <Avatar className="h-10 w-10 shrink-0 border">
                  <AvatarImage src={customer.avatar_url ?? ""} alt={customer.full_name} />
                  <AvatarFallback>{initials || "??"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", isSelected && "text-primary")}>{customer.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{customer.plan_name ?? "Sin plan"}</p>
                </div>
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    customer.membership_status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40",
                  )}
                  title={customer.membership_status}
                />
              </Link>
            );
          })}

          {!isLoading && !error && results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No se encontraron clientes</div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
