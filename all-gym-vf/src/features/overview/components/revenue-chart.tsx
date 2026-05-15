"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { RevenueByMonth } from "../actions/panel-actions";

interface RevenueChartProps {
  data: RevenueByMonth[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const formatCurrency = (value: number) => {
    return `Q${value.toLocaleString("es-GT", { minimumFractionDigits: 0 })}`;
  };

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Ingresos por Mes</CardTitle>
        <p className="text-sm text-muted-foreground">Evolución de los últimos 6 meses</p>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--success)" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" vertical={false} opacity={0.3} />
            <XAxis
              dataKey="month"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `Q${value}`}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.1 }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-md p-3 shadow-2xl">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground font-bold">
                          Ingresos del Mes
                        </span>
                        <span className="font-black text-xl text-success">
                          {formatCurrency(payload[0].value as number)}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="revenue" fill="url(#revenueGradient)" radius={[6, 6, 0, 0]} barSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
