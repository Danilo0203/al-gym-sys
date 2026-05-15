"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import type { SubscriptionsFlow } from "../actions/panel-actions";

interface SubscriptionsFlowChartProps {
  data: SubscriptionsFlow[];
}

export function SubscriptionsFlowChart({ data }: SubscriptionsFlowChartProps) {
  return (
    <Card className="col-span-4 md:col-span-3 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Altas vs Bajas</CardTitle>
        <p className="text-sm text-muted-foreground">Flujo de suscripciones por mes</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" vertical={false} opacity={0.3} />
            <XAxis
              dataKey="month"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-md p-3 shadow-2xl">
                      <p className="font-black mb-2.5 text-xs tracking-wider uppercase opacity-70">{label}</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-success shadow-[0_0_8px_rgba(var(--success),0.5)]" />
                            <span className="text-xs font-semibold">Nuevas</span>
                          </div>
                          <span className="text-sm font-black text-success">{payload[0]?.value}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(var(--destructive),0.5)]" />
                            <span className="text-xs font-semibold">Bajas</span>
                          </div>
                          <span className="text-sm font-black text-destructive">{payload[1]?.value}</span>
                        </div>
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
                <span className="text-xs font-bold px-2 tracking-wide uppercase opacity-80">
                  {value === "newSubs" ? "Nuevas" : "Bajas"}
                </span>
              )}
            />
            <Line
              type="monotone"
              dataKey="newSubs"
              name="newSubs"
              stroke="var(--success)"
              strokeWidth={4}
              dot={{ fill: "var(--success)", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--background)" }}
            />
            <Line
              type="monotone"
              dataKey="cancelled"
              name="cancelled"
              stroke="var(--destructive)"
              strokeWidth={4}
              dot={{ fill: "var(--destructive)", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--background)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
