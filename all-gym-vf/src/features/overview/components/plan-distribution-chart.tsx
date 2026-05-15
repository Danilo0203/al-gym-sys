"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cell, Pie, PieChart, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { PieLabelRenderProps, TooltipContentProps } from "recharts";
import type { PlanDistribution } from "../actions/panel-actions";

interface PlanDistributionChartProps {
  data: PlanDistribution[];
}

type ChartValue = number | string | ReadonlyArray<number | string>;
type ChartName = number | string;

export function PlanDistributionChart({ data }: PlanDistributionChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Distribución de Planes</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <p className="text-muted-foreground">No hay datos disponibles</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Distribución de Planes</CardTitle>
        <p className="text-sm text-muted-foreground">Suscripciones activas por tipo</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              fill="#8884d8"
              paddingAngle={3}
              dataKey="count"
              nameKey="name"
              label={(props: PieLabelRenderProps) => {
                const { cx, cy, midAngle, outerRadius, payload } = props;
                const item = payload as PlanDistribution;
                const RADIAN = Math.PI / 180;
                const radius = (outerRadius ?? 0) + 25;
                const x = (cx ?? 0) + radius * Math.cos(-((midAngle ?? 0) * RADIAN));
                const y = (cy ?? 0) + radius * Math.sin(-((midAngle ?? 0) * RADIAN));

                return (
                  <text
                    x={x}
                    y={y}
                    fill="var(--foreground)"
                    textAnchor={x > (cx ?? 0) ? "start" : "end"}
                    dominantBaseline="central"
                    className="text-[10px] font-bold tracking-tighter"
                  >
                    {`${item.percentage}%`}
                  </text>
                );
              }}
              labelLine={{ stroke: "var(--muted)", strokeWidth: 1 }}
              stroke="var(--background)"
              strokeWidth={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }: TooltipContentProps<ChartValue, ChartName>) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as PlanDistribution;
                  return (
                    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-md p-3 shadow-2xl">
                      <p className="font-black mb-1.5 text-xs tracking-wider uppercase opacity-70">{item.name}</p>
                      <div className="flex items-center gap-2.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <p className="text-sm font-black">
                          {item.count} <span className="text-muted-foreground font-medium text-xs">miembros</span>
                        </p>
                        <span className="ml-auto text-xs font-bold bg-muted px-1.5 py-0.5 rounded">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              formatter={(value) => (
                <span className="text-xs font-bold px-2 tracking-wide uppercase opacity-80">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
