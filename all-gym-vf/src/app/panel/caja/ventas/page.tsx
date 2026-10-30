import Link from "next/link";
import { redirect } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { getSalesHistory } from "@/features/cash/actions/cash-receipt-actions";
import { SaleDetailDialog } from "@/features/cash/components/sale-detail-dialog";

export const metadata = { title: "AlGym: Historial de ventas" };

export default async function SalesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) redirect("/iniciar-sesion");
  if (!hasPermission(access, "cash.operate")) redirect("/panel");
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const page = Math.min(100000, Math.max(1, Math.trunc(Number(value("page")) || 1)));
  const dateValue = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(value(key)) ? value(key) : "";
  const filters = { page: String(page), search: value("search").slice(0, 150), dateFrom: dateValue("dateFrom"), dateTo: dateValue("dateTo") };
  const result = await getSalesHistory(filters);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const pageUrl = (next: number) => "/panel/caja/ventas?" + new URLSearchParams({ ...filters, page: String(next) }).toString();
  return <PageContainer scrollable pageTitle="Historial de ventas" pageDescription="Cobros de membresías y productos, con detalle y recibo opcional.">
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{result.total} ventas encontradas</p>
        <div className="flex gap-2"><Button asChild variant="outline"><Link href="/panel/caja">Ir a caja</Link></Button>
          <Button asChild variant="outline"><Link href="/panel/caja/historial">Historial de turnos</Link></Button></div>
      </div>
      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
        <div className="space-y-1"><label htmlFor="sales-search" className="text-sm">Cliente o número de venta</label>
          <Input id="sales-search" name="search" defaultValue={filters.search} placeholder="Buscar venta…" maxLength={150} /></div>
        <div className="space-y-1"><label htmlFor="sales-from" className="text-sm">Desde</label><Input id="sales-from" name="dateFrom" type="date" defaultValue={filters.dateFrom} /></div>
        <div className="space-y-1"><label htmlFor="sales-to" className="text-sm">Hasta</label><Input id="sales-to" name="dateTo" type="date" defaultValue={filters.dateTo} /></div>
        <div className="flex items-end gap-2"><Button type="submit">Buscar</Button><Button asChild variant="ghost"><Link href="/panel/caja/ventas">Limpiar</Link></Button></div>
      </form>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table><TableHeader><TableRow>
          <TableHead>Fecha</TableHead><TableHead>Venta</TableHead><TableHead>Cliente</TableHead>
          <TableHead>Pago</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Acciones</TableHead>
        </TableRow></TableHeader><TableBody>
          {result.data.length === 0 && <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No hay ventas con estos filtros.</TableCell></TableRow>}
          {result.data.map(sale => <TableRow key={sale.id}>
            <TableCell className="whitespace-nowrap">{new Intl.DateTimeFormat("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" }).format(new Date(sale.date))}</TableCell>
            <TableCell><p className="font-medium">{sale.category === "product" ? "Productos" : sale.category === "enrollment" ? "Inscripción" : sale.category === "membership_enrollment" ? "Membresía + inscripción" : "Membresía / cobro"}</p>
              <p className="max-w-48 truncate text-xs text-muted-foreground" title={sale.reference}>{sale.reference}</p></TableCell>
            <TableCell>{sale.customer}</TableCell>
            <TableCell>{sale.method === "cash" ? "Efectivo" : sale.method === "card" ? "Tarjeta" : "Transferencia"}</TableCell>
            <TableCell><Badge variant={sale.status === "posted" ? "secondary" : "destructive"}>{sale.status === "posted" ? "Registrado" : "Anulado / reversado"}</Badge></TableCell>
            <TableCell className="text-right font-semibold">{new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(sale.total)}</TableCell>
            <TableCell className="text-right"><SaleDetailDialog id={sale.id} /></TableCell>
          </TableRow>)}
        </TableBody></Table>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">Página {page} de {pages}</span>
        <div className="flex gap-2">
          {page > 1 && <Button variant="outline" asChild><Link href={pageUrl(page - 1)}>Anterior</Link></Button>}
          {page < pages && <Button variant="outline" asChild><Link href={pageUrl(page + 1)}>Siguiente</Link></Button>}
        </div>
      </div>
    </div>
  </PageContainer>;
}
