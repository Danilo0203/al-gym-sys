import Link from "next/link";
import { ArrowLeft, Home, Search, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type NotFoundPageProps = {
  compact?: boolean;
};

const quickLinks = [
  { href: "/panel/resumen", label: "Ir al panel" },
  { href: "/mi/rutina", label: "Mi espacio" },
  { href: "/", label: "Inicio" },
];

export function NotFoundPage({ compact = false }: NotFoundPageProps) {
  return (
    <main
      className={cn(
        "relative isolate overflow-hidden bg-background text-foreground",
        compact ? "flex min-h-full items-center justify-center px-4 py-8" : "flex min-h-screen items-center justify-center px-6 py-10",
      )}
    >
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,_rgba(255,59,48,0.16),_transparent_36%),radial-gradient(circle_at_85%_20%,_rgba(255,184,0,0.14),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_32%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(255,59,48,0.18),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(255,184,0,0.12),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_32%)]" />
      <div className="absolute inset-0 -z-10 opacity-60 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(180deg,white,transparent_82%)]" />
      <div className="absolute left-[-8rem] top-[-6rem] -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl motion-safe:animate-pulse" />
      <div className="absolute bottom-[-7rem] right-[-7rem] -z-10 h-96 w-96 rounded-full bg-accent/20 blur-3xl motion-safe:animate-pulse" />

      <section className="relative z-10 w-full max-w-5xl">
        <div className={cn("grid gap-8", compact ? "lg:grid-cols-[1.2fr_0.8fr]" : "lg:grid-cols-[1.15fr_0.85fr]") }>
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground shadow-sm backdrop-blur">
              <ShieldAlert className="h-3.5 w-3.5 text-primary" />
              Ruta no encontrada
            </div>

            <div className="space-y-4">
              <p className="font-[family-name:var(--font-instrument)] text-7xl leading-none tracking-[-0.08em] text-foreground sm:text-8xl lg:text-[8.5rem]">
                404
              </p>
              <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Esta página no existe en All Gym.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Puede que el enlace esté roto, la ruta cambió o ya no tengas acceso a ese módulo. Usa uno de los accesos rápidos para volver sin perder el contexto.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="shadow-lg shadow-primary/15">
                <Link href="/panel/resumen">
                  <Home className="h-4 w-4" />
                  Ir al panel
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-background/80 backdrop-blur">
                <Link href="/mi/rutina">
                  <ArrowLeft className="h-4 w-4" />
                  Mi espacio
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {quickLinks.map((link) => (
                <Button key={link.href} asChild variant="ghost" size="sm" className="rounded-full px-3 text-muted-foreground hover:text-foreground">
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
            </div>
          </div>

          <Card className="border-border/70 bg-card/85 shadow-2xl shadow-black/5 backdrop-blur-xl dark:shadow-black/30">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Qué puedes hacer ahora</p>
                  <p className="text-sm text-muted-foreground">Regresa a un módulo seguro y continúa.</p>
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                {[
                  "Revisa si escribiste bien la ruta.",
                  "Vuelve al panel principal o a tu espacio.",
                  "Si esperabas ver un cliente, confirma que exista y tengas acceso.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border bg-background/70 px-4 py-3 text-muted-foreground">
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
