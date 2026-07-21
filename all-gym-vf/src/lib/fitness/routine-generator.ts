import type { BodyType } from "@/lib/fitness/types";
import type { SupabaseClient } from "@supabase/supabase-js";

interface TemplateRow {
  day_index: number;
  exercise_order: number;
  exercise_name: string;
  sets: number;
  reps_range: string;
  rest_seconds: number;
  routine_mode: "definicion" | "volumen";
}

export async function generateRoutineFromTemplates(params: {
  supabase: SupabaseClient;
  userId: string;
  createdBy: string;
  bodyType: BodyType;
  routineMode: "definicion" | "volumen";
  startDate?: string | null;
  endDate?: string | null;
}) {
  const { supabase, userId, createdBy, bodyType, routineMode, startDate, endDate } = params;

  const { data: templates, error: templateError } = await supabase
    .from("routine_templates")
    .select("day_index, exercise_order, exercise_name, sets, reps_range, rest_seconds, routine_mode")
    .eq("body_type", bodyType)
    .eq("routine_mode", routineMode)
    .order("day_index", { ascending: true })
    .order("exercise_order", { ascending: true });

  if (templateError) throw templateError;
  if (!templates || templates.length === 0) {
    throw new Error(`No routine templates found for ${bodyType}/${routineMode}`);
  }

  const routineName = `Rutina ${bodyType} ${routineMode}`.trim();
  const { data: routine, error: routineError } = await supabase
    .from("routines")
    .insert({
      user_id: userId,
      created_by: createdBy,
      name: routineName,
      start_date: startDate ?? null,
      end_date: endDate ?? null,
      is_active: true,
      goal: routineMode === "definicion" ? "Definición" : "Volumen",
    })
    .select("id")
    .single();

  if (routineError || !routine) throw routineError || new Error("Failed to create routine");

  // Resolve exercise names to IDs in a single query.
  const uniqueNames = Array.from(new Set((templates as TemplateRow[]).map((t) => t.exercise_name)));
  const { data: exerciseRows, error: exerciseError } = await supabase
    .from("exercises")
    .select("id, name")
    .in("name", uniqueNames);

  if (exerciseError) throw exerciseError;
  const exerciseMap = new Map((exerciseRows || []).map((e) => [e.name, e.id]));

  const detailRows = (templates as TemplateRow[])
    .flatMap((t) => {
      const exerciseId = exerciseMap.get(t.exercise_name);
      if (!exerciseId) return [];
      return [{
        routine_id: routine.id,
        day_of_week: t.day_index,
        exercise_id: exerciseId,
        sets: t.sets,
        reps: t.reps_range,
        rest_seconds: t.rest_seconds,
      }];
    });

  if (detailRows.length > 0) {
    const { error: detailError } = await supabase.from("routine_details").insert(detailRows);
    if (detailError) throw detailError;
  }

  return routine.id;
}
