"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WindowsExport } from "./windows-export";

const endpoint = "/api/windows-export/session";
async function read(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "No fue posible conectar con Hostinger.");
  return data as { connected: boolean; expiresAt: number | null };
}
export function HostingerExport() {
  const [connected, setConnected] = useState(false), [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true), [available, setAvailable] = useState(false), [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [error, setError] = useState("");
  const disconnected = useCallback(() => {
    setConnected(false); setExpiresAt(null); setError("La conexión de exportación expiró. Conecta otra vez tu cuenta de Hostinger.");
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await read(await fetch(endpoint, { cache: "no-store" }));
      setConnected(result.connected); setExpiresAt(result.expiresAt); setAvailable(true);
    } catch (e) { setAvailable(false); setError(e instanceof Error ? e.message : "No fue posible consultar Hostinger."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!connected || !expiresAt) return;
    const timer = setTimeout(disconnected, Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [connected, expiresAt, disconnected]);
  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await read(await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }) }));
      setConnected(result.connected); setExpiresAt(result.expiresAt);
    } catch (e) { setError(e instanceof Error ? e.message : "No fue posible conectar la cuenta."); }
    finally { setPassword(""); setBusy(false); }
  }
  async function disconnect() {
    setBusy(true); setError("");
    try { await read(await fetch(endpoint, { method: "DELETE" })); setConnected(false); setExpiresAt(null); }
    catch (e) { setError(e instanceof Error ? e.message : "No fue posible desconectar."); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto w-full max-w-3xl space-y-6 pb-8">
    <Card><CardHeader><CardTitle>{connected ? "Hostinger conectado" : "Conectar con Hostinger"}</CardTitle>
      <CardDescription>{connected ? "Puedes preparar y descargar una copia con tu cuenta propietaria de Hostinger." : "Usa el correo y la contraseña de la cuenta propietaria del sistema que todavía utiliza Hostinger."}</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      {loading ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />Comprobando la conexión…</p> :
        connected ? <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Esta conexión es temporal y no cambia tu sesión local de AlGym.</p>
          <Button variant="outline" disabled={busy} onClick={() => void disconnect()}><LogOut className="mr-2 size-4" />Desconectar este equipo</Button>
        </div> : available ? <form onSubmit={event => void connect(event)} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="hostinger-email">Correo de Hostinger</Label><Input id="hostinger-email" type="email" autoComplete="username" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></div>
          <div className="space-y-2"><Label htmlFor="hostinger-password">Contraseña de Hostinger</Label><Input id="hostinger-password" type="password" autoComplete="current-password" maxLength={256} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></div>
          <p className="text-sm text-muted-foreground">La conexión requiere internet. AlGym no guarda tu contraseña de Hostinger.</p>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Conectar cuenta propietaria</Button>
        </form> : <Button variant="outline" onClick={() => void refresh()}>Comprobar conexión</Button>}
      {error && <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="size-5 shrink-0" />{error}</p>}
    </CardContent></Card>
    {connected && <WindowsExport onDisconnected={disconnected} />}
  </div>;
}
