'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Label } from 'recharts';
import { IconCash, IconCreditCard, IconArrowsExchange, IconHelp } from '@tabler/icons-react';
import type { PaymentMethodDistribution } from '../actions/panel-actions';

// Configuración de colores (Mantenemos tu configuración que estaba bien)
const PAYMENT_CONFIG: Record<string, { label: string; color: string; bgClass: string; textClass: string; icon: React.ElementType }> = {
  efectivo: {
    label: 'Efectivo',
    color: '#10b981', // emerald-500
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-500',
    icon: IconCash,
  },
  tarjeta: {
    label: 'Tarjeta',
    color: '#3b82f6', // blue-500
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-500',
    icon: IconCreditCard,
  },
  transferencia: {
    label: 'Transferencia',
    color: '#a855f7', // purple-500
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-500',
    icon: IconArrowsExchange,
  },
  default: {
    label: 'Otro',
    color: '#71717a', // zinc-500
    bgClass: 'bg-zinc-500/10',
    textClass: 'text-zinc-500',
    icon: IconHelp,
  },
};

interface PaymentMethodChartProps {
  data: PaymentMethodDistribution[];
}

export function PaymentMethodChart({ data }: PaymentMethodChartProps) {
  const formatCurrency = (amount: number) => {
    return `Q${amount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
  };

  const total = useMemo(() => data.reduce((sum, item) => sum + item.amount, 0), [data]);

  const enhancedData = useMemo(() => {
    return data.map((item) => {
      const key = item.method.toLowerCase();
      const config = PAYMENT_CONFIG[key] || PAYMENT_CONFIG.default;
      return {
        ...item,
        fill: config.color,
        config,
      };
    });
  }, [data]);

  // Si no hay datos
  if (data.length === 0) {
    return (
      <Card className="flex flex-col h-full shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Métodos de Pago</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center min-h-[200px]">
          <p className="text-sm text-muted-foreground">Sin datos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full shadow-sm border-border/60">
      <CardHeader className="pb-0">
        <CardTitle className="text-base font-semibold">Métodos de Pago</CardTitle>
        <CardDescription className="text-xs">Ingresos del mes</CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 p-4">
        <div className="flex flex-col h-full">
          
          {/* GRÁFICA: Más compacta y fina */}
          <div className="h-[180px] w-full relative -mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={enhancedData}
                  cx="50%"
                  cy="50%"
                  // AJUSTE CLAVE: Anillo más fino y pequeño para que no se vea tosco
                  innerRadius={60} 
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="amount"
                  stroke="hsl(var(--card))" // Borde del color de la tarjeta para separar segmentos
                  strokeWidth={4}
                  cornerRadius={5}
                >
                  {enhancedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="central"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) - 16}
                              className="fill-muted-foreground text-[10px] font-medium uppercase tracking-widest"
                            >
                              Total
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 6}
                              className="fill-foreground text-xl font-bold tracking-tighter"
                            >
                              {formatCurrency(total).split('.')[0]} {/* Solo enteros grande */}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 24}
                              className="fill-muted-foreground text-xs font-medium"
                            >
                              .{formatCurrency(total).split('.')[1]} {/* Decimales pequeños */}
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md text-popover-foreground">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.fill }} />
                            <span className="font-medium">{item.method}</span>
                          </div>
                          <div className="mt-1 font-bold">{formatCurrency(item.amount)}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* LISTA: Debajo, limpia y sin bordes pesados */}
          <div className="mt-2 space-y-3">
            {enhancedData.map((item) => {
              const percentage = Math.round((item.amount / total) * 100);
              const { icon: Icon, bgClass, textClass } = item.config;

              return (
                <div key={item.method} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${bgClass} ${textClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium leading-none capitalize">
                        {item.method}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        {percentage}% del total
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold tabular-nums block">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}