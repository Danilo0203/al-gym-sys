"use client";

import { useDeferredValue, useEffect, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  IconArrowsExchange,
  IconCash,
  IconCheck,
  IconCreditCard,
  IconRefresh,
  IconSearch,
  IconTransfer,
  IconUser,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { RenewSubscriptionSheet } from "@/features/customers/components/renew-subscription-sheet";
import {
  getCashCustomerSummary,
  searchCashCustomers,
  type CashCustomerSearchResult,
  type CashCustomerSummary,
} from "@/features/cash/actions/cash-actions";

type CashCustomerPaymentDialogMode = "renewal" | "collect";

interface CashCustomerPaymentDialogProps {
  mode?: CashCustomerPaymentDialogMode;
  trigger: ReactNode;
}

function formatMoney(amount: number | null | undefined) {
  const safeAmount = typeof amount === "number" ? amount : 0;
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(safeAmount);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin registro";
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeZone: "America/Guatemala",
  }).format(new Date(value));
}

function getSubscriptionBadgeVariant(status: string | null | undefined) {
  switch (status) {
    case "active":
      return "success";
    case "expired":
      return "destructive";
    case "pending":
      return "warning";
    default:
      return "outline";
  }
}

function getSubscriptionLabel(status: string | null | undefined) {
  switch (status) {
    case "active":
      return "Activa";
    case "expired":
      return "Vencida";
    case "pending":
      return "Pendiente";
    case "cancelled":
      return "Cancelada";
    default:
      return "Sin suscripción";
  }
}

function getPaymentMethodLabel(method: string | null | undefined) {
  switch (method) {
    case "cash":
      return "Efectivo";
    case "card":
      return "Tarjeta";
    case "transfer":
      return "Transferencia";
    default:
      return "Sin registro";
  }
}

function getPaymentMethodIcon(method: string | null | undefined) {
  switch (method) {
    case "cash":
      return <IconCash className="h-4 w-4" />;
    case "card":
      return <IconCreditCard className="h-4 w-4" />;
    case "transfer":
      return <IconTransfer className="h-4 w-4" />;
    default:
      return <IconArrowsExchange className="h-4 w-4" />;
  }
}

export function CashCustomerPaymentDialog({
  mode = "collect",
  trigger,
}: CashCustomerPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CashCustomerSearchResult[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CashCustomerSummary | null>(null);
  const [isSearching, startSearchTransition] = useTransition();
  const [isLoadingCustomer, startCustomerTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const normalizedDeferredQuery = deferredQuery.trim();

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    startSearchTransition(async () => {
      try {
        const nextResults = await searchCashCustomers(normalizedDeferredQuery);
        if (!cancelled) {
          setResults(nextResults);
        }
      } catch (error) {
        if (!cancelled) {
          setResults([]);
        }
        toast.error(error instanceof Error ? error.message : "No se pudo buscar clientes");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [normalizedDeferredQuery, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setQuery("");
      setResults([]);
      setSelectedCustomerId(null);
      setSelectedCustomer(null);
    }
  };

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    startCustomerTransition(async () => {
      try {
        const summary = await getCashCustomerSummary(customerId);
        setSelectedCustomer(summary);
      } catch (error) {
        setSelectedCustomer(null);
        toast.error(error instanceof Error ? error.message : "No se pudo cargar el cliente");
      }
    });
  };

  const handleOpenRenew = () => {
    if (!selectedCustomer) {
      return;
    }

    setOpen(false);
    setRenewOpen(true);
  };

  const dialogTitle = mode === "renewal" ? "Renovar suscripción" : "Cobro a cliente";
  const dialogDescription =
    mode === "renewal"
      ? "Busca al cliente, revisa su estado actual y continúa con la renovación dentro de la caja abierta."
      : "Busca al cliente y cobra su renovación sin entrar al expediente completo.";
  const primaryActionLabel = mode === "renewal" ? "Renovar y cobrar" : "Cobrar renovación";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-w-[calc(100%-2rem)] overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
            <div className="border-b md:border-r md:border-b-0">
              <Command shouldFilter={false} className="rounded-none">
                <CommandInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Busca por nombre o teléfono..."
                />
                <CommandList className="max-h-[26rem]">
                  <CommandEmpty>
                    {normalizedDeferredQuery.length === 0
                      ? "No hay clientes disponibles para mostrar."
                      : "No se encontraron clientes."}
                  </CommandEmpty>
                  <CommandGroup heading={isSearching ? "Buscando..." : normalizedDeferredQuery.length === 0 ? "Clientes" : "Resultados"}>
                    {results.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        value={customer.id}
                        onSelect={() => handleSelectCustomer(customer.id)}
                        className="items-start gap-3 px-4 py-3"
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-transparent",
                            selectedCustomerId === customer.id && "border-primary bg-primary text-primary-foreground",
                          )}
                        >
                          <IconCheck className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium">{customer.full_name}</span>
                            <Badge variant={getSubscriptionBadgeVariant(customer.subscription_status)}>
                              {getSubscriptionLabel(customer.subscription_status)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>{customer.phone || "Sin teléfono"}</span>
                            <span>{customer.plan_name || "Sin plan"}</span>
                            <span>Vence: {formatDate(customer.subscription_end_date)}</span>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            <div className="space-y-4 p-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Ficha compacta</h3>
                <p className="text-sm text-muted-foreground">
                  Confirma el contexto del cliente y continúa con el cobro dentro del turno actual.
                </p>
              </div>

              {!selectedCustomer ? (
                <Card className="gap-4 border-dashed">
                  <CardContent className="flex min-h-[18rem] flex-col items-center justify-center gap-3 text-center">
                    <div className="rounded-full border p-3 text-muted-foreground">
                      <IconSearch className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Selecciona un cliente</p>
                      <p className="text-sm text-muted-foreground">
                        La ficha compacta mostrará plan actual, vigencia y último pago.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="gap-4">
                  <CardHeader className="pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{selectedCustomer.full_name}</CardTitle>
                        <CardDescription>{selectedCustomer.phone || "Sin teléfono registrado"}</CardDescription>
                      </div>
                      <Badge variant={selectedCustomer.is_active ? "success" : "outline"}>
                        {selectedCustomer.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs uppercase text-muted-foreground">Plan actual</p>
                        <p className="mt-1 font-medium">{selectedCustomer.plan_name || "Sin plan activo"}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs uppercase text-muted-foreground">Estado de suscripción</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant={getSubscriptionBadgeVariant(selectedCustomer.subscription_status)}>
                            {getSubscriptionLabel(selectedCustomer.subscription_status)}
                          </Badge>
                        </div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs uppercase text-muted-foreground">Vencimiento</p>
                        <p className="mt-1 font-medium">{formatDate(selectedCustomer.subscription_end_date)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs uppercase text-muted-foreground">Último pago</p>
                        <p className="mt-1 font-medium">{formatMoney(selectedCustomer.last_payment_amount)}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {getPaymentMethodIcon(selectedCustomer.last_payment_method)}
                        <span>{getPaymentMethodLabel(selectedCustomer.last_payment_method)}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Último cobro registrado el {formatDate(selectedCustomer.last_payment_date)}.
                      </p>
                    </div>
                    <Button className="w-full" disabled={isLoadingCustomer} onClick={handleOpenRenew}>
                      <IconRefresh className="h-4 w-4" />
                      {primaryActionLabel}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {isLoadingCustomer ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconUser className="h-4 w-4 animate-pulse" />
                  Cargando ficha compacta del cliente...
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedCustomer ? (
        <RenewSubscriptionSheet
          trigger={null}
          open={renewOpen}
          onOpenChange={setRenewOpen}
          entrypoint="cash"
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.full_name}
          customerGender={selectedCustomer.gender}
          customerBirthDate={selectedCustomer.birth_date}
          previousSubscriptionStartDate={selectedCustomer.subscription_start_date}
          previousSubscriptionEndDate={selectedCustomer.subscription_end_date}
          lastAssessment={selectedCustomer.last_assessment}
          trainingProfile={selectedCustomer.training_profile}
        />
      ) : null}
    </>
  );
}
