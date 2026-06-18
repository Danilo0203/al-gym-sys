'use client';

import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { IconLoader2, IconSearch } from '@tabler/icons-react';

export interface CustomerListItem {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  is_active: boolean | null;
}

interface CustomerListProps {
  initialCustomers: CustomerListItem[];
}

interface CustomerListResponse {
  data?: CustomerListItem[];
  error?: string;
}

export function CustomerList({ initialCustomers }: CustomerListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<CustomerListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const params = useParams();
  const deferredSearchTerm = useDeferredValue(searchTerm.trim());
  const currentcustomerId = params?.customerId as string;
  const isSearching = deferredSearchTerm.length > 0;
  const visibleCustomers = isSearching ? results : initialCustomers;

  useEffect(() => {
    if (!isSearching) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();

    const timeoutId = window.setTimeout(async () => {
      try {
        const url = new URL('/api/panel/clientes/sidebar', window.location.origin);
        url.searchParams.set('query', deferredSearchTerm);
        url.searchParams.set('limit', '20');

        const response = await fetch(url.toString(), {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = (await response.json()) as CustomerListResponse;

        if (!response.ok) {
          throw new Error(payload.error || 'No se pudieron cargar los clientes.');
        }

        if (requestIdRef.current !== requestId) return;
        setResults(Array.isArray(payload.data) ? payload.data : []);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        if (requestIdRef.current !== requestId) return;
        setResults([]);
        setError(fetchError instanceof Error ? fetchError.message : 'No se pudieron cargar los clientes.');
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredSearchTerm, initialCustomers, isSearching]);

  return (
    <div className="flex flex-col h-full border-r bg-muted/10 w-full max-w-sm min-w-[300px]">
      <div className="p-4 border-b space-y-4">
        <h2 className="font-semibold text-lg px-2">Clientes</h2>
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => {
              const nextValue = e.target.value;
              setSearchTerm(nextValue);
              if (!nextValue.trim()) {
                setError(null);
                setIsLoading(false);
              } else {
                setError(null);
                setIsLoading(true);
              }
            }}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
            {/* Botón para crear nuevo cliente (Siempre visible) */}
            {/* <Link href="/panel/clientes/new">
                <Button variant="outline" className="w-full justify-start gap-2 mb-2" size="sm">
                    <IconUserPlus className="h-4 w-4" />
                    Nuevo Cliente
                </Button>
            </Link> */}
            
          {isLoading && (
            <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              Buscando clientes...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-4 text-center text-sm text-destructive">
              {error}
            </div>
          )}

          {!error && visibleCustomers.map(customer => {
             const initials = customer.full_name
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .substring(0, 2) || '??';

             const isActive = customer.id === currentcustomerId;

             return (
              <Link 
                key={customer.id} 
                href={`/panel/clientes/${customer.id}/history`}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted/50",
                  isActive && "bg-muted shadow-sm"
                )}
              >
                <Avatar className="h-10 w-10 border">
                  <AvatarImage src={customer.avatar_url || ''} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                  <span className={cn("text-sm font-medium truncate", isActive && "text-primary")}>
                    {customer.full_name}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {customer.plan_name || 'Sin plan'}
                  </span>
                </div>
                {customer.subscription_status === 'active' && (
                    <div className="ml-auto h-2 w-2 rounded-full bg-green-500" title="Activo" />
                )}
              </Link>
             );
          })}
          
          {!isLoading && !error && visibleCustomers.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No se encontraron clientes
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
