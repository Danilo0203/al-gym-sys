"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconScale,
  IconRuler,
  IconActivity,
  IconDroplet,
  IconFlame,
  IconClipboardHeart,
} from "@tabler/icons-react";
import type { BodyAssessmentEntry } from "../../../actions/customer-history-actions";
import { WeightChart } from "./weight-chart";
import { cn } from "@/lib/utils";
import { kilogramsToPounds } from "@/lib/fitness/measurements";

interface BodyAssessmentTabProps {
  bodyAssessments: BodyAssessmentEntry[];
}

export function BodyAssessmentTab({ bodyAssessments }: BodyAssessmentTabProps) {
  const bodyTypeLabels: Record<string, string> = {
    ectomorph: "Ectomorfo",
    mesomorph: "Mesomorfo",
    endomorph: "Endomorfo",
  };

  const bodyTypeColors: Record<string, string> = {
    ectomorph: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    mesomorph: "bg-green-500/10 text-green-500 border-green-500/20",
    endomorph: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };

  // Calcular cambios respecto a la medición anterior
  const assessmentsWithChange = bodyAssessments.map((assessment, idx) => {
    const prev = bodyAssessments[idx + 1]; // anterior en orden cronológico inverso
    const currentWeightLb = kilogramsToPounds(assessment.weight_kg);
    const previousWeightLb = kilogramsToPounds(prev?.weight_kg ?? null);
    return {
      ...assessment,
      weight_lb: currentWeightLb,
      weightChange: previousWeightLb !== null && currentWeightLb !== null ? currentWeightLb - previousWeightLb : null,
    };
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WeightChart data={bodyAssessments} />
        </div>

        <Card className="bg-gradient-to-br from-card to-muted/30 border-primary/10 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <IconClipboardHeart size={120} />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconActivity className="h-5 w-5 text-primary" />
              Estado Actual
            </CardTitle>
            <CardDescription>Resumen de última evaluación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            {bodyAssessments.length > 0 ? (
              <>
                <div className="flex justify-between items-end border-b border-primary/5 pb-4">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Peso</span>
                    <span className="text-3xl font-bold tracking-tight">
                      {kilogramsToPounds(bodyAssessments[0].weight_kg) ?? "-"}{" "}
                      <span className="text-sm font-normal text-muted-foreground">lb</span>
                    </span>
                  </div>
                  {assessmentsWithChange[0].weightChange !== null && (
                    <div
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all",
                        assessmentsWithChange[0].weightChange > 0
                          ? "bg-red-500/10 text-red-500"
                          : assessmentsWithChange[0].weightChange < 0
                            ? "bg-green-500/10 text-green-500"
                            : "bg-gray-500/10 text-gray-500",
                      )}
                    >
                      {assessmentsWithChange[0].weightChange > 0 ? (
                        <IconTrendingUp className="h-3.5 w-3.5" />
                      ) : assessmentsWithChange[0].weightChange < 0 ? (
                        <IconTrendingDown className="h-3.5 w-3.5" />
                      ) : (
                        <IconMinus className="h-3.5 w-3.5" />
                      )}
                        <span>
                          {assessmentsWithChange[0].weightChange > 0 ? "+" : ""}
                          {assessmentsWithChange[0].weightChange.toFixed(1)}
                          {" "}lb
                        </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-background/50 border border-primary/5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">
                      Grasa Corporal
                    </span>
                    <span className="text-lg font-bold">
                      {bodyAssessments[0].body_fat_percentage ? `${bodyAssessments[0].body_fat_percentage}%` : "N/D"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-background/50 border border-primary/5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">
                      Masa Muscular
                    </span>
                    <span className="text-lg font-bold">
                      {bodyAssessments[0].muscle_mass ? `${bodyAssessments[0].muscle_mass} kg` : "N/D"}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <IconScale className="h-4 w-4" /> Somatotipo
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("px-2 font-medium capitalize", bodyTypeColors[bodyAssessments[0].body_type || ""])}
                    >
                      {bodyTypeLabels[bodyAssessments[0].body_type || ""] || bodyAssessments[0].body_type || "N/D"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <IconFlame className="h-4 w-4" /> Calorías Objetivo
                    </span>
                    <span className="font-semibold">
                      {bodyAssessments[0].daily_calories ? `${bodyAssessments[0].daily_calories} kcal` : "N/D"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <IconDroplet className="h-4 w-4" /> Consumo de Agua
                    </span>
                    <span className="font-semibold">
                      {bodyAssessments[0].water_liters_goal ? `${bodyAssessments[0].water_liters_goal} L` : "N/D"}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <IconClipboardHeart className="h-12 w-12 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between pb-2 px-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <IconRuler className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-black text-xl tracking-tight">Historial de Evolución</h3>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest opacity-70">
                Registro físico completo
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-black px-3 py-1 text-xs">
            {bodyAssessments.length} {bodyAssessments.length === 1 ? "ENTRADA" : "ENTRADAS"}
          </Badge>
        </div>

        {bodyAssessments.length === 0 ? (
          <Card className="border-dashed border-primary/20 bg-muted/5 rounded-3xl">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="bg-muted/10 p-4 rounded-full mb-4">
                <IconClipboardHeart className="h-12 w-12 text-muted-foreground/30" />
              </div>
              <p className="text-muted-foreground font-medium">No hay registros de evaluaciones disponibles todavía</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {assessmentsWithChange.map((assessment, index) => (
              <div
                key={assessment.id}
                className={cn(
                  "p-1 rounded-[2.5rem] border transition-all duration-500",
                  index === 0
                    ? "bg-gradient-to-br from-primary/20 via-background to-background border-primary/20 shadow-2xl shadow-primary/5"
                    : "bg-muted/10 border-primary/5 shadow-sm",
                )}
              >
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3">
                  {/* TILE 1: FECHA Y PESO (Main Title) */}
                  <div className="lg:col-span-4 bg-background/60 backdrop-blur-md rounded-[2rem] p-6 flex flex-col justify-between border border-primary/5 min-h-[180px]">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">
                          {format(new Date(assessment.assessment_date), "EEEE", { locale: es })}
                        </span>
                        <h4 className="text-2xl font-black tracking-tighter">
                          {format(new Date(assessment.assessment_date), "dd MMM, yyyy", { locale: es })}
                        </h4>
                      </div>
                      {index === 0 && (
                        <Badge className="bg-primary text-[10px] font-black px-2 py-0 border-none rounded-full text-white">
                          ÚLTIMA
                        </Badge>
                      )}
                    </div>

                    <div className="mt-8 flex items-end justify-between">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase">Peso Corporal</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl font-black tracking-tight">{assessment.weight_lb ?? "-"}</span>
                          <span className="text-lg font-bold text-muted-foreground">lb</span>
                        </div>
                      </div>

                      {assessment.weightChange !== null && (
                        <div
                          className={cn(
                            "flex flex-col items-end mb-1 px-4 py-2 rounded-2xl border",
                            assessment.weightChange > 0
                              ? "bg-red-500/5 border-red-500/10"
                              : assessment.weightChange < 0
                                ? "bg-emerald-500/5 border-emerald-500/10"
                                : "bg-muted/5 border-muted",
                          )}
                        >
                          <span className="text-[10px] font-black uppercase tracking-wider mb-0.5 opacity-60">
                            Cambio
                          </span>
                          <div
                            className={cn(
                              "flex items-center gap-1 font-black text-lg",
                              assessment.weightChange > 0
                                ? "text-red-500"
                                : assessment.weightChange < 0
                                  ? "text-emerald-500"
                                  : "text-muted-foreground",
                            )}
                          >
                            {assessment.weightChange > 0 ? (
                              <IconTrendingUp className="h-5 w-5" />
                            ) : assessment.weightChange < 0 ? (
                              <IconTrendingDown className="h-5 w-5" />
                            ) : (
                              <IconMinus className="h-4 w-4" />
                            )}
                            {assessment.weightChange > 0 ? "+" : ""}
                            {assessment.weightChange.toFixed(1)} lb
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* TILE 2: COMPOSICION (Stats) */}
                  <div className="lg:col-span-5 bg-card rounded-[2rem] p-6 border border-primary/5 grid grid-cols-2 gap-4">
                    <div className="flex flex-col justify-center gap-1 p-4 bg-muted/20 rounded-[1.5rem] border border-primary/5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        Grasa Corp.
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black">{assessment.body_fat_percentage ?? "-"}</span>
                        <span className="text-sm font-bold opacity-50">%</span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center gap-1 p-4 bg-muted/20 rounded-[1.5rem] border border-primary/5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        Masa Muscular
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black">{assessment.muscle_mass ?? "-"}</span>
                        <span className="text-sm font-bold opacity-50">kg</span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center gap-1 p-4 bg-muted/20 rounded-[1.5rem] border border-primary/5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        Estatura
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black">{assessment.height_cm ?? "-"}</span>
                        <span className="text-sm font-bold opacity-50">cm</span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center gap-1 p-4 bg-primary/5 rounded-[1.5rem] border border-primary/10">
                      <span className="text-[10px] font-black uppercase tracking-wider text-primary/80">
                        Somatotipo
                      </span>
                      {assessment.body_type ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "mt-1 text-[10px] font-black uppercase tracking-tighter border-none px-0",
                            bodyTypeColors[assessment.body_type].split(" ")[1],
                          )}
                        >
                          {bodyTypeLabels[assessment.body_type] || assessment.body_type}
                        </Badge>
                      ) : (
                        <span className="text-xl font-black">-</span>
                      )}
                    </div>
                  </div>

                  {/* TILE 3: NUTRICION INTENSIVA */}
                  <div className="lg:col-span-3 bg-gradient-to-br from-card to-muted/20 rounded-[2rem] p-6 border border-primary/5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-2">
                        <IconFlame className="h-3 w-3 text-orange-500" /> kcal diarias
                      </span>
                      <span className="text-2xl font-black tracking-tighter">{assessment.daily_calories ?? "-"}</span>
                    </div>

                    <div className="h-px bg-primary/5 w-full" />

                    <div className="grid grid-cols-1 gap-3 flex-1 justify-center">
                      {assessment.protein_grams || assessment.carbs_grams || assessment.fat_grams ? (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col items-center p-2 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                            <span className="text-lg font-black text-rose-500 leading-none">
                              {assessment.protein_grams || 0}
                            </span>
                            <span className="text-[8px] font-black uppercase mt-1 opacity-70">Prot</span>
                          </div>
                          <div className="flex flex-col items-center p-2 bg-sky-500/5 rounded-2xl border border-sky-500/10">
                            <span className="text-lg font-black text-sky-500 leading-none">
                              {assessment.carbs_grams || 0}
                            </span>
                            <span className="text-[8px] font-black uppercase mt-1 opacity-70">Carbs</span>
                          </div>
                          <div className="flex flex-col items-center p-2 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                            <span className="text-lg font-black text-amber-500 leading-none">
                              {assessment.fat_grams || 0}
                            </span>
                            <span className="text-[8px] font-black uppercase mt-1 opacity-70">Fat</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center p-4 text-[10px] text-muted-foreground italic bg-muted/20 rounded-2xl">
                          Sin macros
                        </div>
                      )}
                    </div>
                  </div>

                  {/* TILE 4: MEDIDAS (Full Width Row below) */}
                  <div className="lg:col-span-7 bg-card rounded-[2rem] p-6 border border-primary/5 flex flex-col md:flex-row items-center gap-6">
                    <div className="flex flex-col gap-0.5 md:mr-4">
                      <h5 className="text-[10px] font-black uppercase tracking-[.2em] text-muted-foreground">
                        Perímetros
                      </h5>
                      <p className="text-xs font-medium text-muted-foreground/60 w-32">
                        Mediciones anatómicas en centímetros
                      </p>
                    </div>

                    <div className="flex-1 grid grid-cols-3 gap-4 w-full">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-primary/5 blur-xl group-hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100" />
                        <div className="relative bg-muted/30 rounded-[1.5rem] p-4 flex flex-col items-center border border-primary/5 transition-transform hover:-translate-y-1">
                          <span className="text-xl font-black">{assessment.chest_cm || "-"}</span>
                          <span className="text-[8px] font-black uppercase tracking-widest mt-1 text-primary">
                            Pecho
                          </span>
                        </div>
                      </div>
                      <div className="relative group">
                        <div className="relative bg-muted/30 rounded-[1.5rem] p-4 flex flex-col items-center border border-primary/5 transition-transform hover:-translate-y-1">
                          <span className="text-xl font-black">{assessment.waist_cm || "-"}</span>
                          <span className="text-[8px] font-black uppercase tracking-widest mt-1 text-primary">
                            Cintura
                          </span>
                        </div>
                      </div>
                      <div className="relative group">
                        <div className="relative bg-muted/30 rounded-[1.5rem] p-4 flex flex-col items-center border border-primary/5 transition-transform hover:-translate-y-1">
                          <span className="text-xl font-black">{assessment.arm_cm || "-"}</span>
                          <span className="text-[8px] font-black uppercase tracking-widest mt-1 text-primary">
                            Brazo
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TILE 5: DIETA Y ACTIVIDAD (Compact) */}
                  <div className="lg:col-span-5 bg-muted/20 rounded-[2rem] p-6 border border-primary/5 flex items-center gap-4">
                    <div className="p-3 bg-background/80 rounded-2xl border border-primary/5">
                      <IconActivity className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex flex-col gap-1 justify-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Nivel de Actividad
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary border-none text-[9px] font-black px-1.5 h-4"
                        >
                          {assessment.diet_type || "-"}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold capitalize">
                        {assessment.activity_level
                          ? assessment.activity_level.replace(/_/g, " ").replace(/(\d+)\s+(\d+)/, "$1 a $2")
                          : "Nivel no definido"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
