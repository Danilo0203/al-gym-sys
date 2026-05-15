"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ClientLoadingState({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <Card className="border-border/70">
        <CardHeader>
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{title}</p>
    </div>
  );
}

export function ClientErrorState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </CardContent>
    </Card>
  );
}
