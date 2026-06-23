import { z } from "zod";

export const authLoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(256),
});

export const authAuthorizationScopeSchema = z.enum(["panel", "client"]);

export const authContextSchema = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.email().nullable(),
    profile: z.object({
      fullName: z.string(),
      role: z.string(),
      isActive: z.boolean(),
    }),
  }),
  authorization: z.object({
    roleSlug: z.string(),
    scope: authAuthorizationScopeSchema,
    permissions: z.array(z.string()),
    isOwner: z.boolean(),
  }),
});

export const authErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;
export type AuthContext = z.infer<typeof authContextSchema>;
export type AuthErrorResponse = z.infer<typeof authErrorResponseSchema>;

export function parseJsonText(text: string, source: string): unknown {
  if (!text.trim()) {
    throw new Error(`${source} returned an empty body.`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(
      `${source} returned invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export function parseAuthContext(payload: unknown, source: string): AuthContext {
  const result = authContextSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`${source} returned an invalid auth contract.`);
  }

  return result.data;
}

export function parseAuthLoginRequest(payload: unknown): AuthLoginRequest {
  return authLoginRequestSchema.parse(payload);
}

export function getAuthErrorMessage(payload: unknown): string | null {
  const result = authErrorResponseSchema.safeParse(payload);
  return result.success ? result.data.error.message : null;
}
