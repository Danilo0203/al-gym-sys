import PageContainer from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";

type AttendanceRow = {
  device_id: string;
  biometric_id: number;
  punch_time: string;
  status1: number | null;
  status2: number | null;
  status3: number | null;
  status4: number | null;
  status5: number | null;
  raw_line: string | null;
  created_at: string;
};

type DeviceCommandRow = {
  id: number;
  device_id: string;
  command: string;
  executed: boolean;
  return_code: string | null;
  created_at: string;
};

type QueryValue = string | string[] | undefined;

type AttendancePageProps = {
  searchParams: Promise<{
    date_from?: QueryValue;
    date_to?: QueryValue;
    device_id?: QueryValue;
    biometric_id?: QueryValue;
    limit?: QueryValue;
  }>;
};

function firstQueryValue(v: QueryValue): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function badgeVariantForCommand(row: DeviceCommandRow): "success" | "warning" | "secondary" {
  if (!row.executed) return "secondary";
  if (!row.return_code || row.return_code === "0") return "success";
  return "warning";
}

function badgeLabelForCommand(row: DeviceCommandRow): string {
  if (!row.executed) return "Pendiente";
  if (!row.return_code || row.return_code === "0") return "OK";
  return `Error (${row.return_code})`;
}

function toShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchJson<T>(url: URL, token: string): Promise<T> {
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url.toString(), {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T;
}

export const metadata = {
  title: "Panel: Asistencias",
};

export default async function AttendancePage(props: AttendancePageProps) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect("/iniciar-sesion");
  }
  if (!hasPermission(access, "attendance.view")) {
    redirect("/panel");
  }

  const searchParams = await props.searchParams;
  const dateFrom = firstQueryValue(searchParams.date_from) || "";
  const dateTo = firstQueryValue(searchParams.date_to) || "";
  const deviceId = firstQueryValue(searchParams.device_id) || "";
  const biometricId = firstQueryValue(searchParams.biometric_id) || "";
  const limit = firstQueryValue(searchParams.limit) || "200";

  const baseUrl = process.env.GYM_SYNC_SERVER_URL || "http://127.0.0.1:8080";
  const token = process.env.GYM_SYNC_API_TOKEN || "";

  const attendanceUrl = new URL("/api/attendance", baseUrl);
  attendanceUrl.searchParams.set("limit", limit);
  if (dateFrom) attendanceUrl.searchParams.set("date_from", dateFrom);
  if (dateTo) attendanceUrl.searchParams.set("date_to", dateTo);
  if (deviceId) attendanceUrl.searchParams.set("device_id", deviceId);
  if (biometricId) attendanceUrl.searchParams.set("biometric_id", biometricId);

  const commandsUrl = new URL("/api/device-commands", baseUrl);
  commandsUrl.searchParams.set("limit", "100");
  if (deviceId) commandsUrl.searchParams.set("device_id", deviceId);

  let attendanceRows: AttendanceRow[] = [];
  let commandRows: DeviceCommandRow[] = [];
  let loadError = "";

  try {
    const [attendanceRes, commandsRes] = await Promise.all([
      fetchJson<{ data: AttendanceRow[] }>(attendanceUrl, token),
      fetchJson<{ data: DeviceCommandRow[] }>(commandsUrl, token),
    ]);

    attendanceRows = attendanceRes.data || [];
    commandRows = commandsRes.data || [];
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Error desconocido";
  }

  return (
    <PageContainer
      pageTitle="Asistencias"
      pageDescription="Lecturas del reloj (ATTLOG) y estado de comandos enviados al dispositivo"
    >
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-5" method="GET">
            <input
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              name="date_from"
              placeholder="Desde (YYYY-MM-DD)"
              defaultValue={dateFrom}
            />
            <input
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              name="date_to"
              placeholder="Hasta (YYYY-MM-DD)"
              defaultValue={dateTo}
            />
            <input
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              name="device_id"
              placeholder="SN del reloj"
              defaultValue={deviceId}
            />
            <input
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              name="biometric_id"
              placeholder="ID biométrico"
              defaultValue={biometricId}
            />
            <div className="flex gap-2">
              <input
                className="border-input bg-background w-24 rounded-md border px-3 py-2 text-sm"
                name="limit"
                placeholder="Límite"
                defaultValue={limit}
              />
              <button className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium" type="submit">
                Filtrar
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loadError ? (
        <Card className="mb-4 border-red-500">
          <CardHeader>
            <CardTitle>Error al cargar datos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">No fue posible consultar el sync server: {loadError}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Revisa `GYM_SYNC_SERVER_URL`, `GYM_SYNC_API_TOKEN` y que `gym-sync-server` esté encendido.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Registros de asistencia ({attendanceRows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[50dvh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>ID biométrico</TableHead>
                  <TableHead>Status1</TableHead>
                  <TableHead>Status2</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      Sin registros
                    </TableCell>
                  </TableRow>
                ) : (
                  attendanceRows.map((row, index) => (
                    <TableRow key={`${row.device_id}-${row.biometric_id}-${row.punch_time}-${index}`}>
                      <TableCell>{toShortDate(row.punch_time)}</TableCell>
                      <TableCell>{row.device_id}</TableCell>
                      <TableCell>{row.biometric_id}</TableCell>
                      <TableCell>{row.status1 ?? "-"}</TableCell>
                      <TableCell>{row.status2 ?? "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comandos al dispositivo ({commandRows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[40dvh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Comando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commandRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      Sin comandos
                    </TableCell>
                  </TableRow>
                ) : (
                  commandRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{toShortDate(row.created_at)}</TableCell>
                      <TableCell>{row.device_id}</TableCell>
                      <TableCell>
                        <Badge variant={badgeVariantForCommand(row)}>{badgeLabelForCommand(row)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[400px] truncate" title={row.command}>
                        {row.command}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
