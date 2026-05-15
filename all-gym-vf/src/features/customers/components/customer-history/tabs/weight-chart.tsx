"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { IconScale } from "@tabler/icons-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BodyAssessmentEntry } from "../../../actions/customer-history-actions";
import { kilogramsToPounds } from "@/lib/fitness/measurements";

export const description = "Gráfico interactivo de peso";

const chartConfig = {
  weight: {
    label: "Peso (lb)",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

interface WeightChartProps {
  data: BodyAssessmentEntry[];
}

export function WeightChart({ data }: WeightChartProps) {
  const [timeRange, setTimeRange] = React.useState("90d");

  // Transform data
  const chartData = React.useMemo(() => {
    return data
      .filter((item) => item.weight_kg !== null && item.weight_kg !== undefined)
      .sort((a, b) => new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime())
      .map((item) => ({
        date: item.assessment_date, // Keep as string ISO
        weight: kilogramsToPounds(item.weight_kg as number) as number,
      }));
  }, [data]);

  const filteredData = React.useMemo(() => {
    const referenceDate = new Date();
    let daysToSubtract = 90;
    if (timeRange === "30d") {
      daysToSubtract = 30;
    } else if (timeRange === "7d") {
      daysToSubtract = 7;
    } else if (timeRange === "all") {
      return chartData;
    }

    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    return chartData.filter((item) => new Date(item.date) >= startDate);
  }, [chartData, timeRange]);

  // Handle empty state
  if (chartData.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-6 bg-muted/20">
        <p className="text-muted-foreground text-sm">No hay datos suficientes.</p>
      </Card>
    );
  }

  return (
    <Card className="border-primary/10 shadow-sm overflow-hidden backdrop-blur-sm bg-card/80">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b border-primary/5 py-5 sm:flex-row bg-muted/20">
        <div className="grid flex-1 gap-1">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <IconScale className="h-4 w-4 text-primary" />
            </div>
            Evolución del Peso
          </CardTitle>
          <CardDescription>Seguimiento de progreso físico</CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto bg-background/50 border-primary/10"
            aria-label="Seleccionar un rango"
          >
            <SelectValue placeholder="Últimos 3 meses" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-primary/10 backdrop-blur-md">
            <SelectItem value="all" className="rounded-lg">
              Todo el Historial
            </SelectItem>
            <SelectItem value="90d" className="rounded-lg">
              Últimos 3 meses
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Últimos 30 días
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Esta semana
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillWeight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-weight)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-weight)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                const date = new Date(value);
                return format(date, "MMM d", { locale: es });
              }}
              stroke="currentColor"
              opacity={0.5}
              fontSize={11}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              stroke="currentColor"
              opacity={0.5}
              fontSize={11}
              domain={["dataMin - 5", "dataMax + 5"]}
              tickFormatter={(value) => `${value} lb`}
            />
            <ChartTooltip
              cursor={{ stroke: "var(--primary)", strokeWidth: 1, strokeDasharray: "4 4" }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return format(date, "PPP", { locale: es });
                  }}
                />
              }
            />
            <Area
              dataKey="weight"
              type="monotone"
              fill="url(#fillWeight)"
              fillOpacity={0.4}
              stroke="var(--color-weight)"
              strokeWidth={3}
              dot={{
                fill: "var(--color-weight)",
                stroke: "var(--background)",
                strokeWidth: 2,
                r: 4,
                fillOpacity: 1,
              }}
              activeDot={{
                r: 6,
                style: { fill: "var(--color-weight)", opacity: 0.9 },
              }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
