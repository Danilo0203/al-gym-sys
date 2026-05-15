import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CashHistoryData } from "@/features/cash/actions/cash-actions";

function formatMoney(amount: number | null | undefined) {
  const safeAmount = typeof amount === "number" ? amount : 0;
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(safeAmount);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Guatemala",
  }).format(new Date(value));
}

function getStatusLabel(status: string) {
  switch (status) {
    case "open":
      return "Abierta";
    case "closed":
      return "Cerrada";
    case "closed_with_difference":
      return "Con diferencia";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
}

function getStatusVariant(status: string) {
  switch (status) {
    case "open":
      return "default";
    case "closed":
      return "secondary";
    case "closed_with_difference":
      return "destructive";
    default:
      return "outline";
  }
}

export function CashHistoryView({ data }: { data: CashHistoryData }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refina el historial por fecha, estado o responsable.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-5">
            <Input type="date" name="dateFrom" defaultValue={data.filters.dateFrom ?? ""} />
            <Input type="date" name="dateTo" defaultValue={data.filters.dateTo ?? ""} />
            <select
              name="status"
              defaultValue={data.filters.status ?? "all"}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Todos los estados</option>
              <option value="open">Abiertas</option>
              <option value="closed">Cerradas</option>
              <option value="closed_with_difference">Con diferencia</option>
              <option value="cancelled">Canceladas</option>
            </select>

            {data.access.role === "admin" ? (
              <select
                name="openedByUserId"
                defaultValue={data.filters.openedByUserId ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los usuarios</option>
                {data.availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            ) : (
              <input type="hidden" name="openedByUserId" value={data.filters.openedByUserId ?? ""} />
            )}

            <div className="flex items-center gap-2">
              <Button type="submit">Aplicar</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/panel/caja/historial">Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sesiones de caja</CardTitle>
          <CardDescription>
            {data.access.role === "admin"
              ? "Historial completo de aperturas y cierres."
              : "Historial de tus sesiones de caja."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay sesiones que coincidan con los filtros.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sesión</TableHead>
                  <TableHead>Caja</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead>Fondo</TableHead>
                  <TableHead>Diferencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.session_number}</TableCell>
                    <TableCell>{session.cash_register_name}</TableCell>
                    <TableCell>{session.opened_by_name}</TableCell>
                    <TableCell>{formatDateTime(session.opened_at)}</TableCell>
                    <TableCell>{formatDateTime(session.closed_at)}</TableCell>
                    <TableCell>{formatMoney(session.opening_amount)}</TableCell>
                    <TableCell>{formatMoney(session.difference_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(session.status)}>{getStatusLabel(session.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/panel/caja/historial/${session.id}`}>Ver detalle</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
