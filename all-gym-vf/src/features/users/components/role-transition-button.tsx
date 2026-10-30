"use client";

import { useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { IconUserCog } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { customersKeys, useCustomer } from "@/features/customers/hooks/use-customers";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";
import { transitionUserRole } from "../actions/role-transition-actions";

interface TransitionProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "client" | "trainer";
  is_active: boolean;
  birth_date?: string | null;
}

export function RoleTransitionButton({ profile, compact = false }: { profile: TransitionProfile; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: actor } = useCurrentUser();
  const canTransition = actor?.isOwner || (
    actor?.role === "admin" && actor.permissions.includes("users.update") && actor.permissions.includes("customers.update")
  );
  if (!canTransition) return null;
  const label = profile.role === "client" ? "Cambiar a entrenador" : "Cambiar a cliente";

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant={compact ? "ghost" : "outline"} size={compact ? "icon" : "default"}
              className={compact ? "h-8 w-8" : undefined}
              onClick={(event) => { event.stopPropagation(); setOpen(true); }}>
              <IconUserCog className="h-4 w-4" />
              <span className={compact ? "sr-only" : undefined}>{label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {open && <RoleTransitionDialog profile={profile} onClose={() => setOpen(false)} />}
    </>
  );
}

function RoleTransitionDialog({ profile, onClose }: { profile: TransitionProfile; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const customerQuery = useCustomer(profile.role === "client" ? profile.id : null);
  const loading = profile.role === "client" && customerQuery.isPending;
  const loadError = profile.role === "client" && customerQuery.isError;
  const destination = profile.role === "client" ? "entrenador" : "cliente";

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cambiar a {destination}</DialogTitle>
          <DialogDescription>
            {profile.full_name || profile.email} conservará su cuenta e historial de pagos, membresías y asistencias.
            Si ya tiene número biométrico, se conserva.
          </DialogDescription>
        </DialogHeader>
        {loading ? <p className="py-4 text-sm text-muted-foreground">Consultando la cuenta…</p> : loadError ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">No se pudo consultar la cuenta. {customerQuery.error?.message}</p>
            <Button variant="outline" onClick={() => customerQuery.refetch()}>Reintentar</Button>
          </div>
        ) : (
          <RoleTransitionForm
            profile={customerQuery.data ? {
              ...profile,
              email: customerQuery.data.account.email,
              is_active: customerQuery.data.is_active,
            } : profile}
            hasPassword={customerQuery.data?.account.has_password ?? true}
            pending={pending}
            setPending={setPending}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoleTransitionForm({ profile, hasPassword, pending, setPending, onClose }: {
  profile: TransitionProfile;
  hasPassword: boolean;
  pending: boolean;
  setPending: (value: boolean) => void;
  onClose: () => void;
}) {
  const formId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [isActive, setIsActive] = useState(profile.is_active);
  const [email, setEmail] = useState(profile.email ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toTrainer = profile.role === "client";
  const destination = toTrainer ? "entrenador" : "cliente";
  const needsBirthDate = !toTrainer && !profile.birth_date;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if ((password || !hasPassword) && password !== passwordConfirmation) {
      setError("La confirmación de contraseña no coincide.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await transitionUserRole({
        id: profile.id,
        role: toTrainer ? "trainer" : "client",
        is_active: isActive,
        ...(toTrainer && !profile.email ? { email: email.trim() } : {}),
        ...(toTrainer && password ? { password } : {}),
        ...(needsBirthDate ? { birth_date: birthDate } : {}),
      });
      if (!result.success) {
        setError(result.error ?? "No se pudo cambiar el rol.");
        return;
      }
      onClose();
      // The customer detail endpoint only serves the client role.
      queryClient.removeQueries({ queryKey: customersKeys.detail(profile.id) });
      void queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (toTrainer && pathname.startsWith(`/panel/clientes/${profile.id}`)) {
        router.replace("/panel/usuarios");
      }
      router.refresh();
      toast.success(toTrainer ? "Ahora aparece en Usuarios como entrenador." : "Ahora aparece en Clientes. Revisa su membresía para habilitar el ingreso.");
      if (result.syncPending) toast.warning("El rol se guardó. El reloj está pendiente de sincronización.");
    } catch {
      setError("No se pudo confirmar el cambio. Actualiza el listado antes de volver a intentarlo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
        <p>{toTrainer
          ? "Pasará de Clientes a Usuarios. Como entrenador activo podrá entrar al panel y al gimnasio sin membresía."
          : "Pasará de Usuarios a Clientes y perderá el acceso al panel. Para ingresar al gimnasio necesitará una membresía vigente."}</p>
        <p>Se cerrarán sus sesiones para aplicar el nuevo rol. Las membresías conservarán sus fechas; este cambio no las cancela ni las renueva.</p>
      </div>

      {toTrainer && (
        <>
          {profile.email ? (
            <p className="text-sm">Correo de acceso: <strong>{profile.email}</strong></p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`${formId}-email`}>Correo de acceso del entrenador</Label>
              <Input id={`${formId}-email`} type="email" required maxLength={254} autoComplete="off"
                value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} />
              <p className="text-xs text-muted-foreground">El acceso del personal requiere un correo electrónico.</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor={`${formId}-password`}>{hasPassword ? "Nueva contraseña (opcional)" : "Contraseña del entrenador"}</Label>
            <Input id={`${formId}-password`} type="password" required={!hasPassword} minLength={8} maxLength={128}
              autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} />
            <p className="text-xs text-muted-foreground">{hasPassword
              ? "Deja este campo vacío para conservar su contraseña actual."
              : "Esta cuenta todavía no tiene contraseña. Configura una de 8 a 128 caracteres."}</p>
          </div>
          {(password || !hasPassword) && (
            <div className="space-y-2">
              <Label htmlFor={`${formId}-confirm`}>Confirmar contraseña</Label>
              <Input id={`${formId}-confirm`} type="password" required minLength={8} maxLength={128} autoComplete="new-password"
                value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} disabled={pending} />
            </div>
          )}
        </>
      )}
      {needsBirthDate && (
        <div className="space-y-2">
          <Label htmlFor={`${formId}-birth`}>Fecha de nacimiento</Label>
          <Input id={`${formId}-birth`} type="date" required value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)} disabled={pending} />
          <p className="text-xs text-muted-foreground">Completa este dato para crear su ficha de cliente.</p>
        </div>
      )}
      <div className="flex items-start gap-3 rounded-lg border p-3">
        <Checkbox id={`${formId}-active`} checked={isActive} onCheckedChange={(value) => setIsActive(value === true)} disabled={pending} />
        <div className="space-y-1">
          <Label htmlFor={`${formId}-active`}>Dejar la cuenta activa como {destination}</Label>
          <p className="text-xs text-muted-foreground">{isActive
            ? "Podrá iniciar sesión con su nuevo rol."
            : "Quedará inactiva hasta que la reactives."}</p>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : `Confirmar cambio a ${destination}`}</Button>
      </DialogFooter>
    </form>
  );
}
