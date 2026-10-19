"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { TooltipContentProps } from "recharts";
import type { PlanDistribution } from "../actions/panel-actions";

interface PlanDistributionChartProps {
  data: PlanDistribution[];
}

type ChartValue = number | string | ReadonlyArray<number | string>;
type ChartName = number | string;

export function PlanDistributionChart({ data }: PlanDistributionChartProps) {
  const total = data.reduce((sum, plan) => sum + plan.count, 0);

  if (data.length === 0) {
    return (
      <Card className="h-full">
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
    <Card className="h-full">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg font-semibold">Distribución de Planes</CardTitle>
        <p className="text-sm text-muted-foreground">Suscripciones activas por tipo</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="h-[190px] w-full shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={54}
                outerRadius={76}
                paddingAngle={3}
                dataKey="count"
                nameKey="name"
                stroke="var(--background)"
                strokeWidth={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;

                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                        <tspan x={viewBox.cx} dy="-0.3em" className="fill-muted-foreground text-[11px] font-medium">
                          Total
                        </tspan>
                        <tspan x={viewBox.cx} dy="1.35em" className="fill-foreground text-2xl font-bold tabular-nums">
                          {total.toLocaleString("es-GT")}
                        </tspan>
                      </text>
                    );
                  }}
                />
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
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="grid gap-2" aria-label="Planes activos">
          {data.map((plan, index) => (
            <li key={`${plan.name}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: plan.color }} aria-hidden="true" />
                <span className="min-w-0 text-xs font-semibold uppercase leading-tight tracking-wide break-words">
                  {plan.name}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums">
                <span className="font-semibold">{plan.percentage}%</span>
                <span className="ml-2 text-muted-foreground">({plan.count})</span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
