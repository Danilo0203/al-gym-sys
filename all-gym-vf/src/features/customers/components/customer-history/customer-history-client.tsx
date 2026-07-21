"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  IconArrowLeft,
  IconCoin,
  IconCalendarStats,
  IconBarbell,
  IconScale,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconCreditCard,
  IconFileCertificate,
  IconRun,
  IconActivity,
  IconChartLine,
  IconEdit,
  IconTrash,
  IconUserOff,
  IconUserCheck,
  IconMail,
  IconPhone,
} from "@tabler/icons-react";
import Link from "next/link";
import { differenceInCalendarDays, formatDistanceToNow } from "date-fns";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";
import { es } from "date-fns/locale";
import type { CustomerRoutineWorkspace } from "@/lib/training/types";
import type {
  CustomerProfile,
  CustomerHistoryKPIs,
  AccessLogEntry,
  PaymentEntry,
  SubscriptionEntry,
  BodyAssessmentEntry,
} from "../../actions/customer-history-actions";

// Import sub-components
import {
  AccessHistoryTab,
  PaymentHistoryTab,
  SubscriptionHistoryTab,
  BodyAssessmentTab,
  RoutineWorkspaceTab,
} from "./tabs";
import { cn } from "@/lib/utils";
import { kilogramsToPounds } from "@/lib/fitness/measurements";
import { getSubscriptionAccessUntilDate, parseLocalDate } from "@/lib/subscriptions/grace-period";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertModal } from "@/components/modal/alert-modal";
import { CustomerStatusActionSummary } from "@/features/customers/components/customer-status-action-summary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomerFormSheet } from "@/features/customers/components/customer-form-sheet";
import {
  permanentlyDeleteCustomer,
} from "@/features/customers/actions/customer-actions";
import { useCustomer } from "@/features/customers/hooks/use-customers";
import type { TrainingProfileRecord } from "@/lib/training/types";
import { updateCustomerStatus } from "@/features/customers/lib/customer-api";

function toCustomerGender(value: string | null): "male" | "female" | "other" | null {
  if (value === "male" || value === "female" || value === "other") return value;
  return null;
}

function getSubscriptionHeaderMeta(
  status: string | null | undefined,
  endDate: string | Date | null | undefined,
  graceDays?: number | null,
  accessUntil?: string | Date | null,
) {
  if (!status || status === "cancelled") {
    return {
      label: status === "cancelled" ? "Plan cancelado" : "Sin plan",
      tone: "muted" as const,
    };
  }

  if (endDate) {
    const parsedEndDate = parseLocalDate(endDate);
    const parsedAccessUntil = accessUntil ? parseLocalDate(accessUntil) : getSubscriptionAccessUntilDate(endDate, graceDays ?? 0);
    const today = parseLocalDate(new Date());

    if (parsedEndDate && parsedAccessUntil && today) {
      const daysLeft = differenceInCalendarDays(parsedEndDate, today);

      if (parsedAccessUntil < today) {
        return { label: "Plan vencido", tone: "danger" as const };
      }

      if (parsedEndDate < today) {
        return { label: "Plan en prórroga", tone: "warning" as const };
      }

      if (daysLeft <= 3) {
        return { label: "Plan por vencer", tone: "warning" as const };
      }

      return { label: "Plan al dia", tone: "success" as const };
    }
  }

  if (status === "expired") {
    return { label: "Plan vencido", tone: "danger" as const };
  }

  return { label: "Plan al dia", tone: "success" as const };
}


interface CustomerHistoryClientProps {
  profile: CustomerProfile;
  kpis: CustomerHistoryKPIs;
  accessHistory: AccessLogEntry[];
  paymentHistory: PaymentEntry[];
  subscriptionHistory: SubscriptionEntry[];
  bodyAssessments: BodyAssessmentEntry[];
  heatmapData: Record<string, number>;
  routineWorkspace: CustomerRoutineWorkspace;
}

export function CustomerHistoryClient({
  profile,
  kpis,
  accessHistory,
  paymentHistory,
  subscriptionHistory,
  bodyAssessments,
  heatmapData,
  routineWorkspace,
}: CustomerHistoryClientProps) {
  const [activeSection, setActiveSection] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const isScrollingRef = useRef(false);
  const { data: customerDetails } = useCustomer(editOpen ? profile.id : null);
  const { data: currentUser } = useCurrentUser();
  const canUpdateCustomer = Boolean(currentUser?.isOwner || currentUser?.permissions?.includes("customers.update"));
  const canPermanentlyDeleteCustomer = Boolean(currentUser?.isOwner || currentUser?.role === "admin");

  // ScrollSpy Implementation
  useEffect(() => {
    const container = document.getElementById("customer-content-scroll");
    const viewport = container?.querySelector("[data-radix-scroll-area-viewport]");

    if (!viewport) return;

    const handleScroll = () => {
      if (isScrollingRef.current) return;

      const sections = ["overview", "routine", "subscriptions", "payments", "access", "body"];
      let currentSection = sections[0];

      const viewportRect = viewport.getBoundingClientRect();
      // El offset base es el top del viewport (donde empieza el area scrolleable)
      // Le sumamos un pequeño buffer (e.g. 1/3 de la altura del viewport o un valor fijo) para que el cambio se sienta natural
      const offsetBase = viewportRect.top;
      const activationThreshold = offsetBase + 150; // Ajustar este valor según preferencia

      for (const section of sections) {
        const element = document.getElementById(section);
        if (!element) continue;

        const rect = element.getBoundingClientRect();

        // Si el top del elemento está por encima o cerca del umbral de activación
        if (rect.top <= activationThreshold) {
          currentSection = section;
        }
      }

      setActiveSection(currentSection);
    };

    handleScroll(); // Check initial position
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  const initials =
    profile.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2) || "??";

  const memberSinceFormatted = kpis.memberSince
    ? formatDistanceToNow(new Date(kpis.memberSince), { locale: es, addSuffix: true })
    : "N/A";
  const customerEmail = profile.email?.trim() || "Sin correo";
  const customerPhone = profile.phone?.trim() || "Sin teléfono";
  const subscriptionMeta = getSubscriptionHeaderMeta(
    profile.subscription_status,
    profile.subscription_end_date,
    profile.subscription_grace_days,
    profile.subscription_access_until,
  );

  const lastAssessment = bodyAssessments.length > 0 ? bodyAssessments[0] : null;
  const currentSubscription =
    subscriptionHistory.find((subscription) => subscription.status === "active") ?? subscriptionHistory[0];
  const latestPayment = paymentHistory[0];
  const currentWeightLb = kilogramsToPounds(kpis.currentWeight);
  const initialWeightLb = kilogramsToPounds(kpis.initialWeight);
  const weightChangeLb = kilogramsToPounds(kpis.weightChange);
  const lastAssessmentSafe = lastAssessment
    ? {
        weight_kg: lastAssessment.weight_kg ?? 0,
        height_cm: lastAssessment.height_cm ?? 0,
        body_type: lastAssessment.body_type ?? "mesomorph",
        diet_type: lastAssessment.diet_type ?? "normocalorica",
        activity_level: lastAssessment.activity_level ?? "3_5_dias",
        body_fat_percentage: lastAssessment.body_fat_percentage ?? null,
        muscle_mass: lastAssessment.muscle_mass ?? null,
        chest_cm: lastAssessment.chest_cm ?? null,
        waist_cm: lastAssessment.waist_cm ?? null,
        hip_cm: lastAssessment.hip_cm ?? null,
        arm_right_cm: lastAssessment.arm_right_cm ?? lastAssessment.arm_cm ?? null,
        arm_left_cm: lastAssessment.arm_left_cm ?? null,
        leg_right_cm: lastAssessment.leg_right_cm ?? null,
        leg_left_cm: lastAssessment.leg_left_cm ?? null,
        injuries: profile.injuries ?? "",
      }
    : null;

  const trainingProfileForRenewal: TrainingProfileRecord | null = routineWorkspace.trainingProfile ?? null;

  const customerForEditFallback = {
    id: profile.id,
    is_active: profile.is_active,
    email: profile.email,
    full_name: profile.full_name,
    phone: profile.phone,
    birth_date: profile.birth_date,
    gender: profile.gender,
    emergency_contact: null,
    emergency_phone: null,
    plan_id: currentSubscription?.plan_id ?? null,
    subscription_start_date: currentSubscription?.start_date ?? null,
    subscription_end_date: currentSubscription?.end_date ?? null,
    discount_amount: currentSubscription?.discount_amount ?? 0,
    final_price: currentSubscription ? currentSubscription.price - currentSubscription.discount_amount : 0,
    payment_method:
      latestPayment?.payment_method === "cash" ||
      latestPayment?.payment_method === "card" ||
      latestPayment?.payment_method === "transfer"
        ? latestPayment.payment_method
        : "cash",
    weight_kg: lastAssessment?.weight_kg ?? null,
    height_cm: lastAssessment?.height_cm ?? null,
    injuries: profile.injuries ?? null,
    body_type: lastAssessment?.body_type ?? null,
    diet_type: lastAssessment?.diet_type ?? null,
    activity_level: routineWorkspace.trainingProfile?.activity_level ?? lastAssessment?.activity_level ?? null,
    body_fat_percentage: lastAssessment?.body_fat_percentage ?? null,
    muscle_mass_kg: lastAssessment?.muscle_mass ?? null,
    chest: lastAssessment?.chest_cm ?? null,
    waist: lastAssessment?.waist_cm ?? null,
    hip: null,
    arm_right: lastAssessment?.arm_cm ?? null,
    arm_left: null,
    leg_right: null,
    leg_left: null,
    medical_notes: profile.medical_notes ?? null,
    primary_goal: routineWorkspace.trainingProfile?.primary_goal ?? null,
    secondary_goal: routineWorkspace.trainingProfile?.secondary_goal ?? null,
    focus_areas: routineWorkspace.trainingProfile?.focus_areas ?? [],
    experience_level: routineWorkspace.trainingProfile?.experience_level ?? null,
    days_per_week: routineWorkspace.trainingProfile?.days_per_week ?? null,
    session_minutes: routineWorkspace.trainingProfile?.session_minutes ?? null,
    training_location: routineWorkspace.trainingProfile?.training_location ?? "gym",
    equipment_available: routineWorkspace.trainingProfile?.equipment_available ?? [],
    cardio_preference: routineWorkspace.trainingProfile?.cardio_preference ?? null,
    exercise_preferences: routineWorkspace.trainingProfile?.exercise_preferences ?? null,
    exercise_dislikes: routineWorkspace.trainingProfile?.exercise_dislikes ?? null,
    injuries_or_pain: routineWorkspace.trainingProfile?.injuries_or_pain ?? null,
    restricted_movements: routineWorkspace.trainingProfile?.restricted_movements ?? [],
    parq_requires_attention: routineWorkspace.trainingProfile?.parq_requires_attention ?? null,
    medical_clearance_notes: routineWorkspace.trainingProfile?.medical_clearance_notes ?? null,
    training_profile_status: routineWorkspace.trainingProfileStatus,
  };
  const customerForEdit = customerDetails
    ? {
        ...customerForEditFallback,
        ...customerDetails,
        full_name: customerDetails.full_name || profile.full_name,
        email: customerDetails.email || profile.email,
        phone: customerDetails.phone || profile.phone,
        is_active: customerDetails.is_active ?? profile.is_active,
      }
    : null;

  const handleToggleCustomerStatus = async () => {
    if (isDeactivating) return;

    try {
      setIsDeactivating(true);
      const nextIsActive = !profile.is_active;
      await updateCustomerStatus(profile.id, nextIsActive);
      toast.success(
        nextIsActive
          ? "Cliente reactivado correctamente. Esta acción todavía no sincroniza con reloj biométrico en Fase A."
          : "Cliente suspendido correctamente. Esta acción todavía no sincroniza con reloj biométrico en Fase A.",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Error inesperado al ${profile.is_active ? "suspender" : "reactivar"} el cliente`,
      );
    } finally {
      setIsDeactivating(false);
      setDeactivateOpen(false);
    }
  };

  const handlePermanentDeleteCustomer = async () => {
    if (isDeleting) return;

    try {
      setIsDeleting(true);
      const result = await permanentlyDeleteCustomer(profile.id);
      if (!result.success) {
        toast.error(result.error || "No se pudo eliminar completamente el cliente");
        return;
      }

      toast.success("Cliente eliminado del sistema. El reloj puede tardar unos segundos en reflejarlo.");
      router.refresh();
      router.push("/panel/clientes");
    } catch {
      toast.error("Error inesperado al eliminar completamente el cliente");
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

  const scrollToSection = (id: string) => {
    // Buscar específicamente el viewport dentro de nuestro contenedor de historial
    const container = document.getElementById("customer-content-scroll");
    const viewport = container?.querySelector("[data-radix-scroll-area-viewport]");
    const element = document.getElementById(id);

    if (element && viewport) {
      isScrollingRef.current = true;
      setActiveSection(id);
      window.history.replaceState(null, "", `#${id}`);

      const viewportRect = viewport.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Calcular la posición relativa: distancia del elemento al tope del viewport + lo que ya se ha scrolleado
      const relativeTop = elementRect.top - viewportRect.top;
      const targetScroll = viewport.scrollTop + relativeTop - 12; // 12px de padding superior

      viewport.scrollTo({
        top: targetScroll,
        behavior: "smooth",
      });

      // Re-enable scroll spy after animation
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 1000);
    }
  };

  useEffect(() => {
    const targetId = window.location.hash.replace("#", "");
    const validSections = new Set(["overview", "routine", "subscriptions", "payments", "access", "body"]);

    if (!validSections.has(targetId)) return;

    const timeoutId = window.setTimeout(() => {
      const container = document.getElementById("customer-content-scroll");
      const viewport = container?.querySelector("[data-radix-scroll-area-viewport]");
      const element = document.getElementById(targetId);

      if (!element || !viewport) return;

      isScrollingRef.current = true;
      setActiveSection(targetId);

      const viewportRect = viewport.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const relativeTop = elementRect.top - viewportRect.top;

      viewport.scrollTo({
        top: viewport.scrollTop + relativeTop - 12,
        behavior: "auto",
      });

      window.setTimeout(() => {
        isScrollingRef.current = false;
      }, 250);
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, []);

  // ScrollSpy simpler implementation could go here, but omitted for brevity/performance

  return (
    <div className="flex flex-col h-full bg-background/50">
      <AlertModal
        isOpen={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={handleToggleCustomerStatus}
        loading={isDeactivating}
        title={profile.is_active ? "¿Suspender cliente?" : "¿Reactivar cliente?"}
        description={
          <CustomerStatusActionSummary
            customerName={profile.full_name}
            isActive={profile.is_active === true}
            phone={profile.phone}
          />
        }
        confirmText={profile.is_active ? "Suspender" : "Reactivar"}
        confirmVariant={profile.is_active ? "destructive" : "default"}
        contentClassName="sm:max-w-2xl"
      />

      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handlePermanentDeleteCustomer}
        loading={isDeleting}
        title="¿Eliminar cliente completamente?"
        description={
          <div className="space-y-2 mt-2">
            <p>
              El cliente <span className="font-semibold text-foreground">{profile.full_name}</span> se eliminará del
              sistema y del reloj.
            </p>
            <p className="text-sm text-destructive">
              Esta acción intenta borrar también sus huellas del dispositivo y no se puede deshacer.
            </p>
            <p className="text-sm text-muted-foreground">
              El reloj procesa la eliminación por cola ADMS, así que puede tardar unos segundos en desaparecer de la
              pantalla del equipo.
            </p>
          </div>
        }
        confirmText="Eliminar completamente"
      />

      {/* Fixed Header Section */}
      <div className="flex-shrink-0 border-b bg-gradient-to-b from-background via-background to-muted/20 backdrop-blur-xl z-10 shadow-sm">
        {/* Profile Header */}
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="relative group">
                <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border-4 border-background shadow-lg scale-100 group-hover:scale-105 transition-transform duration-300">
                  <AvatarImage src={profile.avatar_url || ""} alt={profile.full_name} />
                  <AvatarFallback className="text-lg font-black bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {profile.is_active && (
                  <div
                    className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 bg-green-500 border-2 border-background rounded-full shadow-lg"
                    title="Cliente Activo"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                  <h1 className="min-w-0 truncate text-xl font-black tracking-tight leading-none sm:text-2xl">
                    {profile.full_name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <HeaderStatusText
                      tone={profile.is_active ? "success" : "muted"}
                      label={profile.is_active ? "Cliente activo" : "Cliente inactivo"}
                    />
                    <HeaderStatusText tone={subscriptionMeta.tone} label={subscriptionMeta.label} />
                  </div>
                </div>

                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <HeaderInlineMeta
                      icon={<IconMail className="h-3.5 w-3.5" />}
                      label={customerEmail}
                      className="min-w-0 max-w-full flex-[0_1_auto]"
                    />
                    <HeaderSeparator />
                    <HeaderInlineMeta
                      icon={<IconPhone className="h-3.5 w-3.5" />}
                      label={customerPhone}
                      className="min-w-[160px] flex-[0_1_auto]"
                    />
                  </div>
                  <HeaderInlineMeta
                    icon={<IconCalendarStats className="h-3.5 w-3.5" />}
                    label={`Miembro ${memberSinceFormatted}`}
                  />
                </div>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
              <Link href="/panel/clientes" className="flex-1 sm:flex-none">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full gap-2 px-3 text-[10px] font-bold uppercase tracking-tighter border-primary/10 hover:bg-primary/5 sm:w-auto"
                >
                  <IconArrowLeft className="h-3.5 w-3.5" />
                  Regresar
                </Button>
              </Link>

              <CustomerFormSheet
                mode="edit"
                customer={customerForEdit}
                open={editOpen}
                onOpenChange={setEditOpen}
                trigger={null}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    data-testid="customer-actions-menu"
                    variant="default"
                    size="sm"
                    className="h-8 flex-1 gap-2 px-3 text-[10px] font-bold uppercase tracking-tighter shadow-lg shadow-primary/20 sm:flex-none"
                  >
                    <IconActivity className="w-3.5 h-3.5" />
                    Acciones
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2">
                  <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                    Gestión de Cliente
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {canUpdateCustomer && (
                  <DropdownMenuItem className="gap-2 py-2 cursor-pointer" onClick={() => setEditOpen(true)}>
                    <IconEdit className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium">Editar Perfil</span>
                  </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {canUpdateCustomer && (
                  <DropdownMenuItem
                    className={cn(
                      "gap-2 py-2 cursor-pointer",
                      profile.is_active
                        ? "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 focus:text-amber-600 focus:bg-amber-500/10"
                        : "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 focus:text-emerald-600 focus:bg-emerald-500/10",
                    )}
                    onClick={() => setDeactivateOpen(true)}
                    disabled={isDeactivating}
                  >
                    {profile.is_active ? <IconUserOff className="h-4 w-4" /> : <IconUserCheck className="h-4 w-4" />}
                    <span className="text-xs font-medium">
                      {profile.is_active ? "Desactivar Cliente" : "Reactivar Cliente"}
                    </span>
                  </DropdownMenuItem>
                  )}
                  {canPermanentlyDeleteCustomer && (
                  <DropdownMenuItem
                    className="gap-2 py-2 cursor-pointer text-red-500 hover:text-red-600 hover:bg-red-500/10 focus:text-red-600 focus:bg-red-500/10"
                    onClick={() => setDeleteOpen(true)}
                    disabled={isDeleting}
                  >
                    <IconTrash className="h-4 w-4" />
                    <span className="text-xs font-medium">Eliminar Completamente</span>
                  </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Fixed below profile) */}
        <div className="flex items-center gap-1 px-4 sm:px-5 lg:px-6 pb-0 overflow-x-auto no-scrollbar scroll-smooth">
          <NavTab
            active={activeSection === "overview"}
            onClick={() => scrollToSection("overview")}
            label="Resumen"
            icon={<IconChartLine className="h-4 w-4" />}
          />
          <NavTab
            active={activeSection === "routine"}
            onClick={() => scrollToSection("routine")}
            label="Rutina"
            icon={<IconBarbell className="h-4 w-4" />}
          />
          <NavTab
            active={activeSection === "subscriptions"}
            onClick={() => scrollToSection("subscriptions")}
            label="Membresías"
            icon={<IconFileCertificate className="h-4 w-4" />}
          />
          <NavTab
            active={activeSection === "payments"}
            onClick={() => scrollToSection("payments")}
            label="Finanzas"
            icon={<IconCoin className="h-4 w-4" />}
          />
          <NavTab
            active={activeSection === "access"}
            onClick={() => scrollToSection("access")}
            label="Accesos"
            icon={<IconRun className="h-4 w-4" />}
          />
          <NavTab
            active={activeSection === "body"}
            onClick={() => scrollToSection("body")}
            label="Evolution"
            icon={<IconScale className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Scrollable Content Area */}
      <ScrollArea className="flex-1 overflow-hidden" id="customer-content-scroll">
        <div className="p-6 lg:p-10 space-y-16 max-w-7xl mx-auto pb-20">
          {/* Overview Section (KPIs) */}
          <section id="overview" className="scroll-mt-32">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              <KPICard
                title="Total Gastado (LTV)"
                value={`Q${kpis.totalSpent.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`}
                icon={<IconCoin className="h-6 w-6" />}
                description="Valor acumulado histórico"
                trend="Finanzas"
                variant="emerald"
              />
              <KPICard
                title="Total de Visitas"
                value={kpis.totalVisits.toString()}
                icon={<IconCalendarStats className="h-6 w-6" />}
                description="Ingresos registrados"
                trend="Actividad"
                variant="blue"
              />
              <KPICard
                title="Peso Actual"
                value={currentWeightLb !== null && currentWeightLb !== undefined ? `${currentWeightLb} lb` : "N/D"}
                icon={<IconScale className="h-6 w-6" />}
                description={
                  initialWeightLb !== null && initialWeightLb !== undefined
                    ? `Inicial: ${initialWeightLb} lb`
                    : "Sin registro inicial"
                }
                trend="Salud"
                variant="purple"
              />
              <KPICard
                title="Cambio de Peso"
                value={
                  weightChangeLb !== null && weightChangeLb !== undefined
                    ? `${weightChangeLb > 0 ? "+" : ""}${weightChangeLb.toFixed(1)} lb`
                    : "N/A"
                }
                icon={
                  kpis.weightChange !== null && kpis.weightChange !== undefined ? (
                    kpis.weightChange > 0 ? (
                      <IconTrendingUp className="h-6 w-6" />
                    ) : kpis.weightChange < 0 ? (
                      <IconTrendingDown className="h-6 w-6" />
                    ) : (
                      <IconMinus className="h-6 w-6" />
                    )
                  ) : (
                    <IconBarbell className="h-6 w-6" />
                  )
                }
                description="Desde ingreso"
                trend="Evolución"
                variant={kpis.weightChange && kpis.weightChange > 0 ? "orange" : "emerald"}
              />
            </div>
          </section>

          <section id="routine" className="scroll-mt-32 space-y-6">
            <SectionHeader icon={<IconBarbell />} title="Rutina Personalizada" />
            <RoutineWorkspaceTab customerId={profile.id} workspace={routineWorkspace} />
          </section>

          <section id="subscriptions" className="scroll-mt-32 space-y-6">
            <SectionHeader icon={<IconFileCertificate />} title="Membresías y Planes" />
            <SubscriptionHistoryTab
              subscriptionHistory={subscriptionHistory}
              customerId={profile.id}
              customerName={profile.full_name || "Cliente"}
              customerGender={toCustomerGender(profile.gender)}
              customerBirthDate={profile.birth_date}
              lastAssessment={lastAssessmentSafe}
              trainingProfile={trainingProfileForRenewal}
            />
          </section>

          <section id="payments" className="scroll-mt-32 space-y-6">
            <SectionHeader icon={<IconCreditCard />} title="Historial Financiero" />
            <PaymentHistoryTab paymentHistory={paymentHistory} />
          </section>

          <section id="access" className="scroll-mt-32 space-y-6">
            <SectionHeader icon={<IconRun />} title="Control de Asistencia" />
            <AccessHistoryTab accessHistory={accessHistory} heatmapData={heatmapData} />
          </section>

          <section id="body" className="scroll-mt-32 space-y-6">
            <SectionHeader icon={<IconActivity />} title="Progreso Somatométrico" />
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Datos físicos</h4>
            <BodyAssessmentTab bodyAssessments={bodyAssessments} />
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

// Subcomponents

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2.5 bg-primary/10 rounded-xl text-primary shadow-sm shadow-primary/5">{icon}</div>
      <h3 className="text-xl font-black tracking-tight">{title}</h3>
      <div className="h-px bg-gradient-to-r from-primary/20 to-transparent flex-1 ml-4" />
    </div>
  );
}

function NavTab({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3.5 py-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-2 outline-none",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
      )}
    >
      <span className={cn("transition-transform duration-300", active && "scale-110")}>{icon}</span>
      {label}
    </button>
  );
}

function HeaderStatusText({ tone, label }: { tone: "success" | "warning" | "danger" | "muted"; label: string }) {
  const tones = {
    success: "text-emerald-400/90",
    warning: "text-amber-400/90",
    danger: "text-rose-400/90",
    muted: "text-muted-foreground",
  };

  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", tones[tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="text-xs font-medium tracking-wide">{label}</span>
    </span>
  );
}

function HeaderInlineMeta({ icon, label, className }: { icon: React.ReactNode; label: string; className?: string }) {
  return (
    <div className={cn("inline-flex min-w-0 items-center gap-2 text-sm text-muted-foreground", className)}>
      <span className="text-foreground/65">{icon}</span>
      <span className="min-w-0 truncate font-medium">{label}</span>
    </div>
  );
}

function HeaderSeparator() {
  return <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/30 sm:inline-block" aria-hidden="true" />;
}

interface KPICardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  trend?: string;
  variant?: "primary" | "emerald" | "blue" | "purple" | "orange";
}

function KPICard({ title, value, icon, description, trend, variant = "primary" }: KPICardProps) {
  const styles = {
    primary: {
      card: "border-primary/10 hover:border-primary/20",
      icon: "bg-primary/10 text-primary group-hover:bg-primary/20",
      trend: "bg-primary/10 text-primary border-primary/20",
      line: "bg-primary",
    },
    emerald: {
      card: "border-emerald-500/10 hover:border-emerald-500/20",
      icon: "bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500/20",
      trend: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      line: "bg-emerald-500",
    },
    blue: {
      card: "border-blue-500/10 hover:border-blue-500/20",
      icon: "bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20",
      trend: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      line: "bg-blue-500",
    },
    purple: {
      card: "border-purple-500/10 hover:border-purple-500/20",
      icon: "bg-purple-500/10 text-purple-600 group-hover:bg-purple-500/20",
      trend: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      line: "bg-purple-500",
    },
    orange: {
      card: "border-orange-500/10 hover:border-orange-500/20",
      icon: "bg-orange-500/10 text-orange-600 group-hover:bg-orange-500/20",
      trend: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      line: "bg-orange-500",
    },
  };

  const currentStyle = styles[variant];

  return (
    <Card
      className={cn(
        "shadow-sm bg-card transition-all duration-300 group overflow-hidden relative border hover:shadow-md",
        currentStyle.card,
      )}
    >
      <div className={cn("absolute top-0 left-0 w-1 h-full opacity-80", currentStyle.line)} />
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1.5">
          <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
            {title}
          </CardTitle>
          {trend && (
            <Badge
              variant="outline"
              className={cn("text-[8px] font-bold uppercase px-1.5 h-4 border", currentStyle.trend)}
            >
              {trend}
            </Badge>
          )}
        </div>
        <div className={cn("p-2 rounded-xl transition-all duration-300 group-hover:scale-110", currentStyle.icon)}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-black tracking-tight">{value}</div>
        <p className="text-[11px] text-muted-foreground mt-2 font-medium">{description}</p>
      </CardContent>
    </Card>
  );
}
