import { z } from "zod";

export const enrollmentQuoteSchema = z.object({ year: z.number().int(), fee: z.number().positive() });
export type EnrollmentQuote = z.infer<typeof enrollmentQuoteSchema>;
export const enrollmentStateSchema = z.object({
  year: z.number().int(), fee: z.number(),
  status: z.enum(["needs_review", "pending", "paid", "recognized"]),
  amount: z.number().nullable(), recorded_at: z.string().nullable(),
  can_manage: z.boolean(), can_collect: z.boolean(),
});
export type EnrollmentState = z.infer<typeof enrollmentStateSchema>;
export function enrollmentLabel(state: EnrollmentState) {
  if (state.status === "paid" || state.status === "recognized") return `Inscrito ${state.year}`;
  return state.status === "needs_review" ? `Inscripción ${state.year}: por verificar` : `Inscripción ${state.year}: pendiente`;
}
export function collectionTotal(membership: number, enrollment?: EnrollmentQuote) {
  return Math.round((membership + (enrollment?.fee ?? 0)) * 100) / 100;
}
