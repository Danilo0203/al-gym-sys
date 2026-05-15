'use client';

import { useState } from 'react';
import { Customer } from '../customer-tables/columns';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { IconSearch } from '@tabler/icons-react';

interface CustomerListProps {
  customers: Customer[];
}

export function CustomerList({ customers }: CustomerListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const params = useParams();
  const currentcustomerId = params?.customerId as string;

  const filteredCustomers = customers.filter(customer => 
    customer.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            onChange={(e) => setSearchTerm(e.target.value)}
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
            
          {filteredCustomers.map(customer => {
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
          
          {filteredCustomers.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No se encontraron clientes
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
