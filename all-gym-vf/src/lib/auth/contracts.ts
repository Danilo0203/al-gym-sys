import { z } from "zod";

export const authLoginRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1).max(256),
  })
  .strict();

export const authChangePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(8).max(128),
  })
  .strict();

export const authAuthorizationScopeSchema = z.enum(["panel", "client"]);

export const authContextSchema = z
  .object({
    user: z
      .object({
        id: z.uuid(),
        email: z.email().nullable(),
        profile: z
          .object({
            fullName: z.string(),
            role: z.string(),
            isActive: z.boolean(),
          })
          .strict(),
      })
      .strict(),
    authorization: z
      .object({
        roleSlug: z.string(),
        scope: authAuthorizationScopeSchema,
        permissions: z.array(z.string()),
        isOwner: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const authChangePasswordResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
  })
  .strict();

export const authErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;
export type AuthChangePasswordRequest = z.infer<
  typeof authChangePasswordRequestSchema
>;
export type AuthContext = z.infer<typeof authContextSchema>;
export type AuthChangePasswordResponse = z.infer<
  typeof authChangePasswordResponseSchema
>;

export function isJsonContentType(value: string | null): boolean {
  if (!value) return false;

  const mediaType = value.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

export function getAuthError(payload: unknown): {
  code: string;
  message: string;
} | null {
  const parsed = authErrorResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data.error : null;
}

export function parseJsonText(text: string, source: string): unknown {
  if (!text.trim()) throw new Error(`${source} returned an empty body.`);
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`${source} returned invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
