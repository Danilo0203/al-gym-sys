"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { CheckCircle2, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormInput } from "@/components/forms/form-input";
import { FieldLabel } from "@/components/ui/field";
import {
  createRole,
  updateRole,
  getPermissions,
  getRolePermissions,
  type RoleData,
  type PermissionData,
} from "../actions/role-actions";

const formSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  slug: z.string().min(2, "El slug debe tener al menos 2 caracteres")
    .regex(/^[a-z0-9_]+$/, "Solo letras minúsculas, números y guiones bajos"),
});

type FormValues = z.infer<typeof formSchema>;

interface RoleFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleData | null;
  onSuccess: () => void;
}

export function RoleFormSheet({ open, onOpenChange, role, onSuccess }: RoleFormSheetProps) {
  const isEditing = !!role;
  const [permissions, setPermissions] = useState<PermissionData[]>([]);
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [permissionQuery, setPermissionQuery] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  useEffect(() => {
    let isMounted = true;

    const hydrateRoleForm = async () => {
      const permissionsResult = await getPermissions();
      if (isMounted) {
        if (permissionsResult.success && permissionsResult.data) {
          setPermissions(permissionsResult.data);
        } else {
          setPermissions([]);
        }
      }

      if (!role) return;

      const rolePermissionsResult = await getRolePermissions(role.id);
      if (!isMounted) return;

      if (rolePermissionsResult.success && rolePermissionsResult.data) {
        setSelectedPermIds(new Set(rolePermissionsResult.data));
      }
    };

    if (open) {
      form.reset({
        name: role?.name || "",
        slug: role?.slug || "",
      });
      setSelectedPermIds(new Set());
      setPermissionQuery("");
      void hydrateRoleForm().catch(() => {
        if (!isMounted) return;
        setPermissions([]);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [open, role, form]);

  const togglePermission = (permId: string) => {
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });
  };

  const toggleModule = (module: string, modulePerms: PermissionData[]) => {
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      const allSelected = modulePerms.every((p) => next.has(p.id));
      if (allSelected) {
        modulePerms.forEach((p) => next.delete(p.id));
      } else {
        modulePerms.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, PermissionData[]>);

  const totalPermissions = permissions.length;
  const selectedCount = selectedPermIds.size;

  const moduleOrder = [
    "users",
    "roles",
    "customers",
    "cash",
    "payments",
    "plans",
    "attendance",
    "routines",
    "exercises",
    "dashboard",
    "profile",
  ];

  const moduleLabels: Record<string, string> = {
    roles: "Roles",
    users: "Usuarios",
    plans: "Planes",
    payments: "Pagos",
    attendance: "Asistencias",
    routines: "Rutinas",
    exercises: "Ejercicios",
    cash: "Caja",
    customers: "Clientes",
    dashboard: "Tablero",
    profile: "Perfil",
  };

  const normalizedQuery = permissionQuery.trim().toLowerCase();

  const moduleEntries = Object.entries(groupedPermissions)
    .sort(([a], [b]) => {
      const indexA = moduleOrder.indexOf(a);
      const indexB = moduleOrder.indexOf(b);
      const safeA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
      const safeB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
      return safeA - safeB;
    })
    .map(([module, modulePerms]) => {
      if (!normalizedQuery) {
        return [module, modulePerms] as const;
      }

      const filteredPerms = modulePerms.filter((perm) => {
        const description = (perm.description || "").toLowerCase();
        const key = perm.key.toLowerCase();
        const label = (moduleLabels[module] || module).toLowerCase();
        return (
          description.includes(normalizedQuery) ||
          key.includes(normalizedQuery) ||
          label.includes(normalizedQuery)
        );
      });

      return [module, filteredPerms] as const;
    })
    .filter(([, modulePerms]) => modulePerms.length > 0);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const actionPromise = isEditing && role
        ? updateRole({
          id: role.id,
          name: values.name !== role.name ? values.name : undefined,
          permissionIds: Array.from(selectedPermIds),
        })
        : createRole({
          name: values.name,
          slug: values.slug,
          permissionIds: Array.from(selectedPermIds),
        });

      toast.promise(actionPromise, {
        loading: isEditing ? "Guardando cambios..." : "Creando rol...",
        success: isEditing ? "Rol actualizado correctamente" : "Rol creado correctamente",
        error: (error) => {
          if (error instanceof Error) return error.message;
          return isEditing ? "Error al actualizar rol" : "Error al crear rol";
        },
      });

      const result = await actionPromise;
      if (result.success) {
        onSuccess();
      }
    } catch {
      toast.error("Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex h-full flex-col overflow-hidden">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-5 w-5 text-primary" />
            {isEditing ? "Editar rol" : "Crear rol"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modifica el nombre y los permisos del rol."
              : "Crea un nuevo rol interno con sus permisos."}
          </SheetDescription>
        </SheetHeader>

        <div className="border-b bg-muted/30 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {selectedCount} de {totalPermissions} permisos seleccionados
            </span>
            {selectedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Configuracion activa
              </span>
            )}
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5 pb-28">
            <FormInput control={form.control} name="name" label="Nombre del rol" placeholder="Ej: Supervisor" />
            {!isEditing && <FormInput control={form.control} name="slug" label="Slug" placeholder="Ej: supervisor" />}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FieldLabel className="text-sm font-semibold">Permisos</FieldLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPermIds(new Set())}
                  disabled={selectedPermIds.size === 0}
                  className="h-8 px-2 text-xs"
                >
                  Limpiar selección
                </Button>
              </div>

              <div className="space-y-2">
                <Input
                  value={permissionQuery}
                  onChange={(event) => setPermissionQuery(event.target.value)}
                  placeholder="Buscar permisos por módulo, acción o clave"
                  className="h-10"
                />
                {normalizedQuery && (
                  <p className="text-xs text-muted-foreground">
                    Mostrando resultados para: <span className="font-medium">{permissionQuery}</span>
                  </p>
                )}
              </div>

              {moduleEntries.map(([module, modulePerms]) => {
                const allSelected = modulePerms.every((p) => selectedPermIds.has(p.id));
                const someSelected = modulePerms.some((p) => selectedPermIds.has(p.id));

                return (
                  <section
                    key={module}
                    className="rounded-xl border bg-card p-3.5 shadow-sm transition-colors hover:bg-muted/20"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allSelected}
                          className={someSelected && !allSelected ? "border-primary" : undefined}
                          ref={(el) => {
                            if (el) {
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              (el as any).indeterminate = !allSelected && someSelected;
                            }
                          }}
                          onCheckedChange={() => toggleModule(module, modulePerms)}
                        />
                        <span className="text-sm font-semibold capitalize">{moduleLabels[module] || module}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {modulePerms.length}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleModule(module, modulePerms)}
                        className="h-7 px-2 text-xs text-muted-foreground"
                      >
                        {allSelected ? "Quitar todo" : "Seleccionar todo"}
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-2 pl-7 sm:grid-cols-2">
                      {modulePerms.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={selectedPermIds.has(perm.id)}
                            onCheckedChange={() => togglePermission(perm.id)}
                            className="mt-0.5"
                          />
                          <span className="text-sm leading-tight text-muted-foreground">
                            {perm.description || perm.key}
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}

              {moduleEntries.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No se encontraron permisos con ese criterio.
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 z-20 mt-auto border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{selectedCount}</span> permisos seleccionados de{" "}
                <span className="font-medium text-foreground">{totalPermissions}</span>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="min-w-36">
                  {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear rol"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
