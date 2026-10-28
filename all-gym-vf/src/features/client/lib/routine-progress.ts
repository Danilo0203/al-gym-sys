import { z } from "zod";

export const routineProgressSchema = z.object({
  routineId: z.uuid().nullable(),
  completedDetailIds: z.array(z.number().int().positive()),
});

export const exerciseCompletionSchema = z.object({
  routineId: z.uuid(),
  detailId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  completed: z.boolean(),
}).strict();

export const resetRoutineDaySchema = z.object({
  routineId: z.uuid(),
  day: z.number().int().min(1).max(7),
}).strict();

export type RoutineProgress = z.infer<typeof routineProgressSchema>;
export type RoutineProgressChange = z.infer<typeof exerciseCompletionSchema> | z.infer<typeof resetRoutineDaySchema>;
