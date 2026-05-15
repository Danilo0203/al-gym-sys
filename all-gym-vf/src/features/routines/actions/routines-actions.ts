"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import type { RoutineRecord } from "@/lib/training/types";

export interface RoutineWithCustomer extends RoutineRecord {
  customer_name: string | null;
  customer_avatar: string | null;
  day_count: number;
  exercise_count: number;
}

export async function getAllRoutines(): Promise<RoutineWithCustomer[]> {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !hasPermission(access, "routines.view")) {
    throw new Error("No autorizado");
  }

  const adminClient = createAdminClient();

  const { data: routines, error: routinesError } = await adminClient
    .from("routines")
    .select("*")
    .in("status", ["draft", "active", "archived"])
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

  if (routinesError) {
    console.error("Error fetching routines:", {
      message: routinesError.message,
      code: routinesError.code,
      details: routinesError.details,
      hint: routinesError.hint,
    });
    throw new Error(
      `No se pudieron cargar las rutinas: ${routinesError.message ?? "error desconocido"}`,
    );
  }

  if (!routines || routines.length === 0) {
    return [];
  }

  const userIds = Array.from(
    new Set(
      routines
        .map((r) => (typeof r.user_id === "string" ? r.user_id : null))
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const profilesMap = new Map<
    string,
    { full_name: string | null; avatar_url: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", {
        message: profilesError.message,
        code: profilesError.code,
        details: profilesError.details,
        hint: profilesError.hint,
      });
    }

    (profiles ?? []).forEach((p) => {
      profilesMap.set(String(p.id), {
        full_name: typeof p.full_name === "string" ? p.full_name : null,
        avatar_url: typeof p.avatar_url === "string" ? p.avatar_url : null,
      });
    });
  }

  const routineIds = routines.map((r) => String(r.id));
  const detailCounts = new Map<string, { days: Set<number>; exercises: number }>();

  if (routineIds.length > 0) {
    const { data: details } = await adminClient
      .from("routine_details")
      .select("routine_id, day_of_week")
      .in("routine_id", routineIds);

    (details ?? []).forEach((row) => {
      const rid = String(row.routine_id);
      const dayNumber = Number(row.day_of_week);
      const bucket = detailCounts.get(rid) ?? { days: new Set<number>(), exercises: 0 };
      if (Number.isFinite(dayNumber)) bucket.days.add(dayNumber);
      bucket.exercises += 1;
      detailCounts.set(rid, bucket);
    });
  }

  return routines.map((row) => {
    const profile = typeof row.user_id === "string" ? profilesMap.get(row.user_id) : undefined;
    const counts = detailCounts.get(String(row.id));

    return {
      id: String(row.id),
      user_id: typeof row.user_id === "string" ? row.user_id : null,
      created_by: typeof row.created_by === "string" ? row.created_by : null,
      name: String(row.name || "Rutina"),
      start_date: typeof row.start_date === "string" ? row.start_date : null,
      end_date: typeof row.end_date === "string" ? row.end_date : null,
      is_active: typeof row.is_active === "boolean" ? row.is_active : null,
      goal: typeof row.goal === "string" ? row.goal : null,
      status: String(row.status || "draft") as RoutineRecord["status"],
      source: String(row.source || "system") as RoutineRecord["source"],
      training_profile_id:
        typeof row.training_profile_id === "string" ? row.training_profile_id : null,
      primary_goal: typeof row.primary_goal === "string" ? row.primary_goal : null,
      secondary_goal: typeof row.secondary_goal === "string" ? row.secondary_goal : null,
      generation_version:
        typeof row.generation_version === "string" ? row.generation_version : null,
      reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
      reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
      created_at: typeof row.created_at === "string" ? row.created_at : undefined,
      customer_name: profile?.full_name ?? null,
      customer_avatar: profile?.avatar_url ?? null,
      day_count: counts?.days.size ?? 0,
      exercise_count: counts?.exercises ?? 0,
    };
  });
}
