"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import type { RoutineBlockType } from "@/lib/training/types";

export interface BlueprintRecord {
  id: string;
  name: string;
  primary_goal: string | null;
  secondary_goal: string | null;
  source_routine_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BlueprintDetailRecord {
  id: number;
  blueprint_id: string;
  day_of_week: number;
  exercise_id: number | null;
  exercise_order: number | null;
  block_type: RoutineBlockType;
  sets: number | null;
  reps: string | null;
  rest_seconds: number | null;
  duration_minutes: number | null;
  target_rir: number | null;
  notes: string | null;
  exercise_name_snapshot: string | null;
  exercise_image_url: string | null;
  exercise_video_url: string | null;
}

type RoutineTemplateSource = {
  id: string;
  name: string | null;
  primary_goal: string | null;
  secondary_goal: string | null;
  created_by: string | null;
  user_id: string | null;
  reviewed_at: string | null;
};

export interface BlueprintAssignmentRecord {
  id: string;
  blueprint_id: string;
  user_id: string;
  assigned_routine_id: string;
  assigned_by: string;
  assigned_at: string;
  customer_name: string | null;
  customer_avatar: string | null;
  routine_status: string | null;
}

export interface BlueprintWithStats extends BlueprintRecord {
  assignment_count: number;
  day_count: number;
  exercise_count: number;
  preview_users: Array<{ name: string | null; avatar: string | null }>;
}

async function requireAdminAccess() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !hasPermission(access, "routines.view")) {
    throw new Error("No autorizado");
  }
  return { adminClient: createAdminClient(), access };
}

async function fetchProfilesForUserIds(
  adminClient: ReturnType<typeof createAdminClient>,
  userIds: string[],
) {
  if (userIds.length === 0) return new Map<string, { full_name: string | null; avatar_url: string | null }>();
  const { data } = await adminClient
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", userIds);
  const map = new Map<string, { full_name: string | null; avatar_url: string | null }>();
  (data ?? []).forEach((p) => {
    map.set(String(p.id), { full_name: typeof p.full_name === "string" ? p.full_name : null, avatar_url: typeof p.avatar_url === "string" ? p.avatar_url : null });
  });
  return map;
}

export async function getAllRoutineBlueprints(): Promise<BlueprintWithStats[]> {
  const { adminClient } = await requireAdminAccess();

  const { data: blueprints, error: bpError } = await adminClient
    .from("routine_blueprints")
    .select("*")
    .order("created_at", { ascending: false });

  if (bpError) throw new Error(`No se pudieron cargar las plantillas: ${bpError.message}`);
  if (!blueprints || blueprints.length === 0) return [];

  const bpIds = (blueprints as Array<Record<string, unknown>>).map((bp) => String(bp.id));

  const [{ data: details }, { data: assignments }] = await Promise.all([
    adminClient
      .from("routine_blueprint_details")
      .select("blueprint_id, day_of_week")
      .in("blueprint_id", bpIds),
    adminClient
      .from("routine_blueprint_assignments")
      .select("blueprint_id, user_id, assigned_routine_id, routines!inner(id, status)")
      .in("blueprint_id", bpIds),
  ]);

  const detailCounts = new Map<string, { days: Set<number>; exercises: number }>();
  (details ?? []).forEach((row) => {
    const bid = String(row.blueprint_id);
    const bucket = detailCounts.get(bid) ?? { days: new Set<number>(), exercises: 0 };
    const day = Number(row.day_of_week);
    if (Number.isFinite(day)) bucket.days.add(day);
    bucket.exercises += 1;
    detailCounts.set(bid, bucket);
  });

  const assignmentData = new Map<
    string,
    { count: number; userIds: string[] }
  >();
  const allUserIds = new Set<string>();
  (assignments ?? []).forEach((row) => {
    const innerRoutine = Array.isArray(row.routines) ? row.routines[0] : row.routines;
    const status = innerRoutine ? String(innerRoutine.status ?? "") : "";
    if (!["active", "draft"].includes(status)) return;
    const bid = String(row.blueprint_id);
    const uid = String(row.user_id);
    const bucket = assignmentData.get(bid) ?? { count: 0, userIds: [] };
    bucket.count += 1;
    bucket.userIds.push(uid);
    assignmentData.set(bid, bucket);
    allUserIds.add(uid);
  });

  const profilesMap = await fetchProfilesForUserIds(adminClient, Array.from(allUserIds));

  return (blueprints as Array<Record<string, unknown>>).map((bp) => {
    const bid = String(bp.id);
    const counts = detailCounts.get(bid) ?? { days: new Set<number>(), exercises: 0 };
    const assignBucket = assignmentData.get(bid) ?? { count: 0, userIds: [] };

    return {
      id: bid,
      name: String(bp.name || "Plantilla"),
      primary_goal: typeof bp.primary_goal === "string" ? bp.primary_goal : null,
      secondary_goal: typeof bp.secondary_goal === "string" ? bp.secondary_goal : null,
      source_routine_id: typeof bp.source_routine_id === "string" ? bp.source_routine_id : null,
      created_by: String(bp.created_by),
      created_at: String(bp.created_at ?? ""),
      updated_at: String(bp.updated_at ?? ""),
      assignment_count: assignBucket.count,
      day_count: counts.days.size,
      exercise_count: counts.exercises,
      preview_users: assignBucket.userIds.slice(0, 4).map((uid) => {
        const profile = profilesMap.get(uid);
        return { name: profile?.full_name ?? null, avatar: profile?.avatar_url ?? null };
      }),
    };
  });
}

export async function saveRoutineAsBlueprint(routineId: string) {
  const { adminClient, access } = await requireAdminAccess();

  const [{ data: routine, error: routineError }, { data: details, error: detailsError }] = await Promise.all([
    adminClient
      .from("routines")
      .select("id, name, primary_goal, secondary_goal, created_by, user_id, reviewed_at")
      .eq("id", routineId)
      .single(),
    adminClient
      .from("routine_details")
      .select(
        "day_of_week, exercise_id, exercise_order, block_type, sets, reps, rest_seconds, duration_minutes, target_rir, notes, exercise_name_snapshot",
      )
      .eq("routine_id", routineId)
      .order("day_of_week", { ascending: true })
      .order("exercise_order", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (routineError || !routine) throw routineError || new Error("No se encontró la rutina.");
  if (detailsError) throw detailsError;

  const source = routine as RoutineTemplateSource;
  const existingBlueprint = await adminClient
    .from("routine_blueprints")
    .select("id, created_by")
    .eq("source_routine_id", routineId)
    .maybeSingle();

  const blueprintPayload = {
    name: String(source.name || "Rutina"),
    primary_goal: source.primary_goal,
    secondary_goal: source.secondary_goal,
    source_routine_id: routineId,
    created_by: source.created_by || access.userId || source.user_id,
    updated_at: new Date().toISOString(),
  };

  let blueprintId: string;

  if (existingBlueprint.data?.id) {
    blueprintId = String(existingBlueprint.data.id);
    const { error: updateError } = await adminClient.from("routine_blueprints").update(blueprintPayload).eq("id", blueprintId);
    if (updateError) throw updateError;

    const { error: clearError } = await adminClient.from("routine_blueprint_details").delete().eq("blueprint_id", blueprintId);
    if (clearError) throw clearError;
  } else {
    const { data: insertedBlueprint, error: insertError } = await adminClient
      .from("routine_blueprints")
      .insert({
        ...blueprintPayload,
        created_at: source.reviewed_at || new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !insertedBlueprint) throw insertError || new Error("No se pudo guardar la plantilla.");
    blueprintId = String(insertedBlueprint.id);
  }

  const detailRows = (details ?? []).map((detail) => ({
    blueprint_id: blueprintId,
    day_of_week: detail.day_of_week,
    exercise_id: detail.exercise_id ?? null,
    exercise_order: detail.exercise_order ?? null,
    block_type: detail.block_type ?? "strength",
    sets: detail.sets ?? null,
    reps: detail.reps ?? null,
    rest_seconds: detail.rest_seconds ?? null,
    duration_minutes: detail.duration_minutes ?? null,
    target_rir: detail.target_rir ?? null,
    notes: detail.notes ?? null,
    exercise_name_snapshot: detail.exercise_name_snapshot ?? null,
  }));

  if (detailRows.length > 0) {
    const { error: detailInsertError } = await adminClient.from("routine_blueprint_details").insert(detailRows);
    if (detailInsertError) throw detailInsertError;
  }

  revalidatePath("/panel/rutinas");
  revalidatePath(`/panel/rutinas/${blueprintId}`);

  return { success: true, blueprintId };
}

export async function getRoutineBlueprintDetail(blueprintId: string): Promise<{
  blueprint: BlueprintRecord;
  details: BlueprintDetailRecord[];
  assignments: BlueprintAssignmentRecord[];
}> {
  const { adminClient } = await requireAdminAccess();

  const [{ data: bpData, error: bpError }, { data: detailsData }, { data: assignmentsData }] =
    await Promise.all([
      adminClient
        .from("routine_blueprints")
        .select("*")
        .eq("id", blueprintId)
        .single(),
      adminClient
        .from("routine_blueprint_details")
        .select("*, exercise:exercises(id, image_url, video_url)")
        .eq("blueprint_id", blueprintId)
        .order("day_of_week", { ascending: true })
        .order("exercise_order", { ascending: true }),
      adminClient
        .from("routine_blueprint_assignments")
        .select("*, routines!inner(id, status)")
        .eq("blueprint_id", blueprintId)
        .order("assigned_at", { ascending: false }),
    ]);

  if (bpError || !bpData) throw new Error("Plantilla no encontrada.");
  const bp = bpData as Record<string, unknown>;

  const details: BlueprintDetailRecord[] = (detailsData ?? []).map((row) => {
    const ex = (Array.isArray(row.exercise) ? row.exercise[0] : row.exercise ?? {}) as Record<string, unknown>;
    return {
      id: Number(row.id),
      blueprint_id: String(row.blueprint_id),
      day_of_week: Number(row.day_of_week),
      exercise_id: typeof row.exercise_id === "number" ? row.exercise_id : null,
      exercise_order: typeof row.exercise_order === "number" ? row.exercise_order : null,
      block_type: String(row.block_type ?? "strength") as RoutineBlockType,
      sets: typeof row.sets === "number" ? row.sets : null,
      reps: typeof row.reps === "string" ? row.reps : null,
      rest_seconds: typeof row.rest_seconds === "number" ? row.rest_seconds : null,
      duration_minutes: typeof row.duration_minutes === "number" ? row.duration_minutes : null,
      target_rir: typeof row.target_rir === "number" ? row.target_rir : null,
      notes: typeof row.notes === "string" ? row.notes : null,
      exercise_name_snapshot: typeof row.exercise_name_snapshot === "string" ? row.exercise_name_snapshot : null,
      exercise_image_url: typeof ex.image_url === "string" ? ex.image_url : null,
      exercise_video_url: typeof ex.video_url === "string" ? ex.video_url : null,
    };
  });

  const assignmentMap = new Map<string, string | null>();
  const assignmentUsers = new Set<string>();
  (assignmentsData ?? []).forEach((row) => {
    const innerRoutine = Array.isArray(row.routines) ? row.routines[0] : row.routines;
    const status = innerRoutine ? String(innerRoutine.status ?? "") : "";
    if (!["active", "draft"].includes(status)) return;
    assignmentUsers.add(String(row.user_id));
    assignmentMap.set(String(row.id), status);
  });

  const profilesMap = await fetchProfilesForUserIds(adminClient, Array.from(assignmentUsers));

  const assignments: BlueprintAssignmentRecord[] = (assignmentsData ?? []).map((row) => {
    const uid = String(row.user_id);
    const profile = profilesMap.get(uid);
    return {
      id: String(row.id),
      blueprint_id: String(row.blueprint_id),
      user_id: uid,
      assigned_routine_id: String(row.assigned_routine_id),
      assigned_by: String(row.assigned_by),
      assigned_at: String(row.assigned_at ?? ""),
      customer_name: profile?.full_name ?? null,
      customer_avatar: profile?.avatar_url ?? null,
      routine_status: assignmentMap.get(String(row.id)) ?? null,
    };
  }).filter((a) => a.routine_status !== null && a.routine_status !== "");

  return {
    blueprint: {
      id: String(bp.id),
      name: String(bp.name || "Plantilla"),
      primary_goal: typeof bp.primary_goal === "string" ? bp.primary_goal : null,
      secondary_goal: typeof bp.secondary_goal === "string" ? bp.secondary_goal : null,
      source_routine_id: typeof bp.source_routine_id === "string" ? bp.source_routine_id : null,
      created_by: String(bp.created_by),
      created_at: String(bp.created_at ?? ""),
      updated_at: String(bp.updated_at ?? ""),
    },
    details,
    assignments,
  };
}

export async function assignRoutineBlueprint(params: {
  blueprintId: string;
  userId: string;
}) {
  const { adminClient, access } = await requireAdminAccess();
  const { blueprintId, userId } = params;

  const [{ data: bp, error: bpError }, { data: detailsData }] = await Promise.all([
    adminClient
      .from("routine_blueprints")
      .select("*")
      .eq("id", blueprintId)
      .single(),
    adminClient
      .from("routine_blueprint_details")
      .select("*")
      .eq("blueprint_id", blueprintId)
      .order("day_of_week", { ascending: true })
      .order("exercise_order", { ascending: true }),
  ]);

  if (bpError || !bp) throw new Error("Plantilla no encontrada.");
  const blueprint = bp as Record<string, unknown>;

  await adminClient
    .from("routines")
    .update({ status: "archived", is_active: false })
    .eq("user_id", userId)
    .in("status", ["active", "pending_profile", "draft"]);

  const { data: newRoutine, error: routineError } = await adminClient
    .from("routines")
    .insert({
      user_id: userId,
      created_by: access.userId,
      name: String(blueprint.name || "Rutina asignada"),
      is_active: true,
      goal: typeof blueprint.primary_goal === "string" ? blueprint.primary_goal : "Personalizada",
      status: "active",
      source: "admin",
      primary_goal: typeof blueprint.primary_goal === "string" ? blueprint.primary_goal : null,
      secondary_goal: typeof blueprint.secondary_goal === "string" ? blueprint.secondary_goal : null,
      generation_version: "blueprint_v1",
      reviewed_by: access.userId,
      reviewed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (routineError || !newRoutine) throw routineError || new Error("No se pudo asignar la rutina.");

  const detailRows = (detailsData ?? []).map((detail) => ({
    routine_id: newRoutine.id,
    day_of_week: detail.day_of_week,
    exercise_id: detail.exercise_id ?? null,
    exercise_order: detail.exercise_order ?? null,
    block_type: detail.block_type ?? "strength",
    sets: detail.sets ?? null,
    reps: detail.reps ?? null,
    rest_seconds: detail.rest_seconds ?? null,
    duration_minutes: detail.duration_minutes ?? null,
    target_rir: detail.target_rir ?? null,
    notes: detail.notes ?? null,
    exercise_name_snapshot: detail.exercise_name_snapshot ?? null,
  }));

  if (detailRows.length > 0) {
    const { error: detailError } = await adminClient
      .from("routine_details")
      .insert(detailRows);
    if (detailError) throw detailError;
  }

  const { error: assignError } = await adminClient
    .from("routine_blueprint_assignments")
    .insert({
      blueprint_id: blueprintId,
      user_id: userId,
      assigned_routine_id: newRoutine.id,
      assigned_by: access.userId,
      assigned_at: new Date().toISOString(),
    });

  if (assignError) throw assignError;

  revalidatePath("/panel/rutinas");
  revalidatePath(`/panel/rutinas/${blueprintId}`);
  revalidatePath(`/panel/clientes/${userId}`);
  revalidatePath(`/panel/clientes/${userId}/history`);
  revalidatePath(`/panel/clientes/${userId}/rutina/activa`);
  revalidatePath(`/panel/clientes/${userId}/rutina/borrador`);

  return { success: true, routineId: newRoutine.id };
}

export async function unassignRoutineBlueprint(params: {
  blueprintId: string;
  userId: string;
}) {
  const { adminClient } = await requireAdminAccess();

  const { error } = await adminClient
    .from("routine_blueprint_assignments")
    .delete()
    .eq("blueprint_id", params.blueprintId)
    .eq("user_id", params.userId);

  if (error) {
    throw new Error(error.message || "No se pudo quitar la asignación.");
  }

  revalidatePath("/panel/rutinas");
  revalidatePath(`/panel/rutinas/${params.blueprintId}`);
  revalidatePath(`/panel/clientes/${params.userId}`);
  revalidatePath(`/panel/clientes/${params.userId}/history`);

  return { success: true };
}

export async function updateRoutineBlueprintName(params: {
  blueprintId: string;
  name: string;
}) {
  const { adminClient } = await requireAdminAccess();
  const nextName = params.name.trim();

  if (!nextName) {
    throw new Error("El nombre de la plantilla no puede estar vacío.");
  }

  const { error } = await adminClient
    .from("routine_blueprints")
    .update({ name: nextName, updated_at: new Date().toISOString() })
    .eq("id", params.blueprintId);

  if (error) {
    throw new Error(error.message || "No se pudo actualizar la plantilla.");
  }

  revalidatePath("/panel/rutinas");
  revalidatePath(`/panel/rutinas/${params.blueprintId}`);

  return { success: true };
}

export interface CreateBlueprintDayInput {
  exercises: Array<{
    exercise_id: number;
    block_type: RoutineBlockType;
    sets: number | null;
    reps: string | null;
    rest_seconds: number | null;
    duration_minutes: number | null;
    target_rir: number | null;
  }>;
}

export interface CreateBlueprintInput {
  title: string;
  primary_goal: string;
  secondary_goal: string | null;
  days: Array<CreateBlueprintDayInput>;
}

export async function createRoutineBlueprintFromScratch(input: CreateBlueprintInput) {
  const { adminClient, access } = await requireAdminAccess();
  const userId = access.userId;

  if (!userId) throw new Error("Usuario no identificado.");

  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");
  if (!input.primary_goal.trim()) throw new Error("El objetivo principal es obligatorio.");
  if (!input.days || input.days.length === 0) throw new Error("Debe tener al menos un día.");
  const totalExercises = input.days.reduce((sum, d) => sum + d.exercises.length, 0);
  if (totalExercises === 0) throw new Error("Debe tener al menos un ejercicio.");

  for (let i = 0; i < input.days.length; i++) {
    const day = input.days[i];
    for (let j = 0; j < day.exercises.length; j++) {
      const ex = day.exercises[j];
      if (!ex.exercise_id) throw new Error(`El ejercicio ${j + 1} del día ${i + 1} no tiene un ejercicio seleccionado.`);
    }
  }

  const { data: blueprint, error: bpError } = await adminClient
    .from("routine_blueprints")
    .insert({
      name: title,
      primary_goal: input.primary_goal,
      secondary_goal: input.secondary_goal,
      source_routine_id: null,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (bpError || !blueprint) throw bpError || new Error("No se pudo crear la plantilla.");

  const blueprintId = String(blueprint.id);
  const detailRows = input.days.flatMap((day, dayIndex) =>
    day.exercises.map((ex, exIndex) => ({
      blueprint_id: blueprintId,
      day_of_week: dayIndex + 1,
      exercise_id: ex.exercise_id,
      exercise_order: exIndex + 1,
      block_type: ex.block_type,
      sets: ex.sets ?? null,
      reps: ex.reps ?? null,
      rest_seconds: ex.rest_seconds ?? null,
      duration_minutes: ex.duration_minutes ?? null,
      target_rir: ex.target_rir ?? null,
    })),
  );

  if (detailRows.length > 0) {
    const { error: detailError } = await adminClient.from("routine_blueprint_details").insert(detailRows);
    if (detailError) throw detailError;
  }

  revalidatePath("/panel/rutinas");
  revalidatePath(`/panel/rutinas/${blueprintId}`);

  return { success: true, blueprintId };
}

export async function searchActiveClients(query: string) {
  const { adminClient } = await requireAdminAccess();

  const { data, error } = await adminClient
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("role", "client")
    .eq("is_active", true)
    .or(`full_name.ilike.%${query}%`)
    .order("full_name", { ascending: true })
    .limit(20);

  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: String(p.id),
    full_name: p.full_name ?? "Sin nombre",
    avatar_url: p.avatar_url ?? null,
  }));
}
