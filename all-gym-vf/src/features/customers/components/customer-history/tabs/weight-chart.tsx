"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
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
import type { CustomerBodyAssessment } from "@/features/customers/lib/customer-health";

export const description = "Gráfico interactivo de evolución corporal";

const chartConfig = {
  value: {
    label: "Medición",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const metrics = {
  weight: { label: "Peso", unit: "kg" },
  bodyFat: { label: "Grasa corporal", unit: "%" },
  muscleMass: { label: "Masa muscular", unit: "kg" },
} as const;

type Metric = keyof typeof metrics;

interface WeightChartProps {
  data: CustomerBodyAssessment[];
}

export function WeightChart({ data }: WeightChartProps) {
  const [timeRange, setTimeRange] = React.useState("90d");
  const [metric, setMetric] = React.useState<Metric>("weight");
  const metricDetails = metrics[metric];

  // Transform data
  const chartData = React.useMemo(() => {
    return data
      .map((item) => ({
        date: item.assessment_date,
        value: metric === "weight"
          ? item.weight_kg
          : metric === "bodyFat"
            ? item.body_fat_percentage
            : item.muscle_mass_kg,
      }))
      .filter((item): item is { date: string; value: number } => item.value !== null && item.date !== null)
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
      .map((item) => ({ date: item.date, value: item.value }));
  }, [data, metric]);

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
    return chartData.filter((item) => parseISO(item.date) >= startDate);
  }, [chartData, timeRange]);

  return (
    <Card className="border-primary/10 shadow-sm overflow-hidden backdrop-blur-sm bg-card/80">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b border-primary/5 py-5 sm:flex-row bg-muted/20">
        <div className="grid flex-1 gap-1">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <IconScale className="h-4 w-4 text-primary" />
            </div>
            Evolución corporal
          </CardTitle>
          <CardDescription>{metricDetails.label} en {metricDetails.unit}, usando únicamente mediciones disponibles</CardDescription>
        </div>
        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
          <Select value={metric} onValueChange={(value) => setMetric(value as Metric)}>
            <SelectTrigger className="w-full rounded-lg bg-background/50 border-primary/10 sm:w-[170px]" aria-label="Seleccionar métrica">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weight">Peso</SelectItem>
              <SelectItem value="bodyFat">Grasa corporal</SelectItem>
              <SelectItem value="muscleMass">Masa muscular</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="w-full rounded-lg bg-background/50 border-primary/10 sm:w-[160px]"
              aria-label="Seleccionar un rango"
            >
              <SelectValue placeholder="Últimos 3 meses" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-primary/10 backdrop-blur-md">
              <SelectItem value="all" className="rounded-lg">Todo el Historial</SelectItem>
              <SelectItem value="90d" className="rounded-lg">Últimos 3 meses</SelectItem>
              <SelectItem value="30d" className="rounded-lg">Últimos 30 días</SelectItem>
              <SelectItem value="7d" className="rounded-lg">Esta semana</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filteredData.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            No hay mediciones de {metricDetails.label.toLowerCase()} disponibles.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillWeight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                const date = parseISO(value);
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
              domain={["auto", "auto"]}
              tickFormatter={(value) => `${value} ${metricDetails.unit}`}
            />
            <ChartTooltip
              cursor={{ stroke: "var(--primary)", strokeWidth: 1, strokeDasharray: "4 4" }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(value) => {
                    const date = parseISO(String(value));
                    return format(date, "PPP", { locale: es });
                  }}
                />
              }
            />
            <Area
              dataKey="value"
              type="monotone"
              fill="url(#fillWeight)"
              fillOpacity={0.4}
              stroke="var(--color-value)"
              strokeWidth={3}
              dot={{
                fill: "var(--color-value)",
                stroke: "var(--background)",
                strokeWidth: 2,
                r: 4,
                fillOpacity: 1,
              }}
              activeDot={{
                r: 6,
                style: { fill: "var(--color-value)", opacity: 0.9 },
              }}
            />
          </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
