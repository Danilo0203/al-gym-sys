"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { IconCalendarStats, IconHistory, IconCheck, IconX } from "@tabler/icons-react";
import type { CustomerHistoryResponse } from "@/features/customers/lib/local-customers";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AccessHistoryTabProps {
  accessHistory: CustomerHistoryResponse["attendance"]["data"];
  heatmapData: Record<string, number>;
}

export function AccessHistoryTab({ accessHistory, heatmapData }: AccessHistoryTabProps) {
  const parseHeatmapDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  };

  // Generar los últimos 12 meses para el heatmap
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: format(date, "MMM", { locale: es }),
      fullLabel: format(date, "MMMM yyyy", { locale: es }),
      year: date.getFullYear(),
      month: date.getMonth(),
    });
  }

  // Calcular visitas por mes
  const visitsByMonth = months.map((m) => {
    let count = 0;
    Object.keys(heatmapData).forEach((date) => {
      const d = parseHeatmapDate(date);
      if (d.getMonth() === m.month && d.getFullYear() === m.year) {
        count += heatmapData[date];
      }
    });
    return count;
  });

  const maxVisits = Math.max(...visitsByMonth, 1);
  const totalVisits = visitsByMonth.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Heatmap simplificado por mes */}
      <Card className="border-primary/10 shadow-sm overflow-hidden backdrop-blur-sm bg-card/80">
        <CardHeader className="bg-muted/30 border-b border-primary/5 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <IconCalendarStats className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Actividad Anual</CardTitle>
                <CardDescription>Frecuencia de visitas al gimnasio</CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-2xl font-black">{totalVisits}</span>
              <span className="text-[10px] uppercase tracking-tighter text-muted-foreground font-bold">
                Visitas Totales
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-8 sm:px-10">
          <div className="grid h-56 grid-cols-12 gap-2 sm:gap-4">
            <TooltipProvider>
              {months.map((month, idx) => (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    <div className="group flex min-w-0 flex-col items-center gap-3 cursor-default">
                      <div className="relative flex h-44 w-full items-end justify-center rounded-xl bg-muted/20 px-2 py-3">
                        <div
                          className={cn(
                            "w-full max-w-[40px] rounded-md border transition-all duration-500 ease-out group-hover:opacity-90",
                            visitsByMonth[idx] > 0
                              ? "border-primary/30 bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.35)]"
                              : "border-border/40 bg-muted/60",
                          )}
                          style={{
                            height: `${Math.max((visitsByMonth[idx] / maxVisits) * 100, visitsByMonth[idx] > 0 ? 12 : 6)}%`,
                            opacity: visitsByMonth[idx] > 0 ? 1 : 0.45,
                          }}
                        />
                        {visitsByMonth[idx] > 0 && (
                          <span className="absolute -top-6 whitespace-nowrap text-[10px] font-bold opacity-0 transition-opacity group-hover:opacity-100">
                            {visitsByMonth[idx]}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground transition-colors group-hover:text-primary">
                        {month.label}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs font-medium">
                      {month.fullLabel}: <span className="font-bold">{visitsByMonth[idx]} visitas</span>
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de accesos */}
      <Card className="border-primary/10 shadow-sm overflow-hidden backdrop-blur-sm bg-card/80">
        <CardHeader className="bg-muted/30 border-b border-primary/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconHistory className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Historial de Ingresos</CardTitle>
              <CardDescription>Registro cronológico de entradas al recinto</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {accessHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No hay registros de acceso</p>
          ) : (
            <Table containerClassName="max-h-[386px] overflow-y-auto">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-y border-primary/5">
                    <TableHead className="sticky top-0 z-20 w-[200px] border-b border-primary/5 bg-muted/95 pl-6 font-bold text-xs uppercase tracking-wider backdrop-blur supports-[backdrop-filter]:bg-muted/85">
                      Fecha y Hora
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 border-b border-primary/5 bg-muted/95 font-bold text-xs uppercase tracking-wider backdrop-blur supports-[backdrop-filter]:bg-muted/85">
                      Día
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 border-b border-primary/5 bg-muted/95 pr-6 text-right font-bold text-xs uppercase tracking-wider backdrop-blur supports-[backdrop-filter]:bg-muted/85">
                      Estado de Acceso
                    </TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                {accessHistory.map((log) => (
                  <TableRow key={log.id} className="hover:bg-primary/[0.02] border-primary/5 transition-colors h-[62px]">
                    <TableCell className="font-medium pl-6">
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {format(new Date(log.check_in_time), "dd/MM/yyyy", { locale: es })}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-bold">
                          {format(new Date(log.check_in_time), "HH:mm 'hs'", { locale: es })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold capitalize">
                        {format(new Date(log.check_in_time), "EEEE", { locale: es })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Badge
                        variant="outline"
                        className={cn(
                          "ml-auto flex w-fit items-center gap-1 rounded-full border-transparent px-2.5 py-0.5 text-[10px] font-bold",
                          log.status === "authorized" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600",
                        )}
                      >
                        {log.status === "authorized" ? (
                          <>
                            <IconCheck className="h-3 w-3 stroke-[3]" />
                            AUTORIZADO
                          </>
                        ) : (
                          <>
                            <IconX className="h-3 w-3 stroke-[3]" />
                            DENEGADO
                          </>
                        )}
                      </Badge>
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
