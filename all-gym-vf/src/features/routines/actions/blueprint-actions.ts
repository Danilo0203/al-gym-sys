"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { parseCustomerApiResponse } from "@/features/customers/lib/local-customers";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";
import type { RoutineBlockType } from "@/lib/training/types";

const blueprintSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  primary_goal: z.string().nullable(),
  secondary_goal: z.string().nullable(),
  source_routine_id: z.uuid().nullable(),
  created_by: z.uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});
const blueprintWithStatsSchema = blueprintSchema.extend({
  assignment_count: z.number().int().nonnegative(),
  day_count: z.number().int().nonnegative(),
  exercise_count: z.number().int().nonnegative(),
  preview_users: z.array(z.object({ name: z.string().nullable(), avatar: z.string().nullable() })),
});
const detailSchema = z.object({
  id: z.number().int(),
  blueprint_id: z.uuid(),
  day_of_week: z.number().int(),
  exercise_id: z.number().int().nullable(),
  exercise_order: z.number().int().nullable(),
  block_type: z.enum(["warmup", "strength", "accessory", "cardio", "mobility"]),
  sets: z.number().int().nullable(),
  reps: z.string().nullable(),
  rest_seconds: z.number().int().nullable(),
  duration_minutes: z.number().int().nullable(),
  target_rir: z.number().nullable(),
  notes: z.string().nullable(),
  exercise_name_snapshot: z.string().nullable(),
  exercise_image_url: z.string().nullable(),
  exercise_video_url: z.string().nullable(),
});
const assignmentSchema = z.object({
  id: z.uuid(),
  blueprint_id: z.uuid(),
  user_id: z.uuid(),
  assigned_routine_id: z.uuid(),
  assigned_by: z.uuid(),
  assigned_at: z.string(),
  customer_name: z.string().nullable(),
  customer_avatar: z.string().nullable(),
  routine_status: z.string().nullable(),
});
const detailResponseSchema = z.object({
  blueprint: blueprintSchema,
  details: z.array(detailSchema),
  assignments: z.array(assignmentSchema),
});
const idResultSchema = z.object({ success: z.literal(true), blueprintId: z.uuid() });
const routineResultSchema = z.object({ success: z.literal(true), routineId: z.uuid() });
const successSchema = z.object({ success: z.literal(true) });

export type BlueprintRecord = z.infer<typeof blueprintSchema>;
export type BlueprintDetailRecord = z.infer<typeof detailSchema>;
export type BlueprintAssignmentRecord = z.infer<typeof assignmentSchema>;
export type BlueprintWithStats = z.infer<typeof blueprintWithStatsSchema>;

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

async function requestBlueprints(path: string, init: RequestInit = {}) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated || !hasPermission(access, "routines.view")) {
    throw new Error("No autorizado");
  }
  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());
  return fetchAuthBackend(`/routine-blueprints${path}`, {
    ...init,
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
}

function refreshBlueprint(blueprintId: string) {
  revalidatePath("/panel/rutinas");
  revalidatePath(`/panel/rutinas/${blueprintId}`);
}

function refreshCustomer(userId: string) {
  revalidatePath(`/panel/clientes/${userId}`);
  revalidatePath(`/panel/clientes/${userId}/history`);
  revalidatePath(`/panel/clientes/${userId}/rutina/activa`);
  revalidatePath(`/panel/clientes/${userId}/rutina/borrador`);
}

export async function getAllRoutineBlueprints(): Promise<BlueprintWithStats[]> {
  const response = await requestBlueprints("");
  const payload = await parseCustomerApiResponse(response, (value) =>
    z.object({ data: z.array(blueprintWithStatsSchema) }).parse(value));
  return payload.data;
}

export async function getRoutineBlueprintDetail(blueprintId: string) {
  const response = await requestBlueprints(`/${encodeURIComponent(blueprintId)}`);
  return parseCustomerApiResponse(response, (value) => detailResponseSchema.parse(value));
}

export async function createRoutineBlueprintFromScratch(input: CreateBlueprintInput) {
  const response = await requestBlueprints("", {
    method: "POST", body: JSON.stringify(input),
  });
  const result = await parseCustomerApiResponse(response, (value) => idResultSchema.parse(value));
  refreshBlueprint(result.blueprintId);
  return result;
}

export async function saveRoutineAsBlueprint(routineId: string) {
  const response = await requestBlueprints(`/from-routine/${encodeURIComponent(routineId)}`, {
    method: "POST",
  });
  const result = await parseCustomerApiResponse(response, (value) => idResultSchema.parse(value));
  refreshBlueprint(result.blueprintId);
  return result;
}

export async function updateRoutineBlueprintName(params: { blueprintId: string; name: string }) {
  const response = await requestBlueprints(`/${encodeURIComponent(params.blueprintId)}`, {
    method: "PATCH", body: JSON.stringify({ name: params.name }),
  });
  const result = await parseCustomerApiResponse(response, (value) => successSchema.parse(value));
  refreshBlueprint(params.blueprintId);
  return result;
}

export async function assignRoutineBlueprint(params: { blueprintId: string; userId: string }) {
  const response = await requestBlueprints(`/${encodeURIComponent(params.blueprintId)}/assign`, {
    method: "POST", body: JSON.stringify({ userId: params.userId }),
  });
  const result = await parseCustomerApiResponse(response, (value) => routineResultSchema.parse(value));
  refreshBlueprint(params.blueprintId);
  refreshCustomer(params.userId);
  return result;
}

export async function unassignRoutineBlueprint(params: { blueprintId: string; userId: string }) {
  const response = await requestBlueprints(
    `/${encodeURIComponent(params.blueprintId)}/assign/${encodeURIComponent(params.userId)}`,
    { method: "DELETE" },
  );
  const result = await parseCustomerApiResponse(response, (value) => successSchema.parse(value));
  refreshBlueprint(params.blueprintId);
  refreshCustomer(params.userId);
  return result;
}

export async function searchActiveClients(query: string) {
  const response = await requestBlueprints(`/clients?query=${encodeURIComponent(query)}`);
  const payload = await parseCustomerApiResponse(response, (value) => z.object({
    data: z.array(z.object({
      id: z.uuid(), full_name: z.string(), avatar_url: z.string().nullable(),
    })),
  }).parse(value));
  return payload.data;
}
