"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerFormSheet } from "@/features/customers/components/customer-form-sheet";
import { submitLegacyCashCustomer } from "@/features/cash/lib/legacy-customer-operations";
import { searchPendingCashCustomers, type CashCustomerSearchResult } from "../actions/cash-actions";
import { getCustomerDetail } from "@/features/customers/lib/customer-api";
import { CustomerData } from "@/features/customers/hooks/use-hook-form-customers";

export function PendingMembershipPaymentDialog() {
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CashCustomerSearchResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      void searchPendingCashCustomers(search).then((data) => {
        if (!cancelled) {
          setItems(data);
        }
      }).catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "No se pudieron cargar los clientes");
      }).finally(() => { if (!cancelled) setLoading(false); });
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [open, search]);

  const handleSelect = async (customerId: string) => {
    setLoading(true);
    try {
      const detail = await getCustomerDetail(customerId);
      setSelectedCustomer(detail as unknown as CustomerData);
      setOpen(false); // Cierra el modal de búsqueda
      setSheetOpen(true); // Abre el sheet
    } catch (_error) {
      toast.error("No se pudo cargar la información del cliente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => {
        setOpen(next);
        if (!next) { setSearch(""); }
      }}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">Cobrar membresía pendiente</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Buscar cliente a cobrar</DialogTitle>
            <DialogDescription>
              Busca clientes nuevos con un plan pendiente o sin plan asignado. Al seleccionar uno, podrás completar su ficha y cobrar el plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label htmlFor="pending-member-search">Buscar por nombre o teléfono</Label>
            <Input id="pending-member-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente..." />
            <div className="max-h-52 space-y-2 overflow-y-auto" role="listbox" aria-label="Clientes a cobrar">
              {items.map((item) => (
                <button type="button" key={item.id} role="option" aria-selected={false}
                  className="w-full rounded-lg border p-3 text-left text-sm hover:bg-muted/50"
                  onClick={() => handleSelect(item.id)}>
                  <span className="font-medium">{item.full_name}</span> · {item.phone || "Sin teléfono"}<br />
                  <span className="text-muted-foreground">
                    {item.subscription_status === "pending" ? "Membresía Pendiente" : "Sin Plan Asignado"}
                    {item.plan_name ? ` · ${item.plan_name}` : ""}
                  </span>
                </button>
              ))}
              {!loading && items.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">No hay clientes pendientes o sin plan con ese nombre.</p> : null}
              {loading ? <p className="p-4 text-center text-sm text-muted-foreground">Buscando…</p> : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sheet prellenado con el cliente seleccionado */}
      {selectedCustomer && (
        <CustomerFormSheet
          mode="edit"
          customer={selectedCustomer}
          open={sheetOpen}
          onOpenChange={(next) => {
            setSheetOpen(next);
            if (!next) setSelectedCustomer(null);
          }}
          entrypoint="cash"
          legacySubmit={submitLegacyCashCustomer}
        />
      )}
    </>
  );
}
