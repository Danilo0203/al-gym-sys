import { z } from "zod";

const userStatusValueSchema = z.enum(["active", "disabled"]);

export const userIdParamSchema = z.object({
  id: z.string().uuid()
});

export const createUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().trim().min(2),
  role: z.string().trim().min(1),
  password: z.string().min(6),
  status: userStatusValueSchema.default("active")
});

export const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    full_name: z.string().trim().min(2).optional(),
    password: z.string().min(6).optional(),
    role: z.string().trim().min(1).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

export const userStatusBodySchema = z.object({
  status: userStatusValueSchema
});

export const userRoleSchema = z.object({
  role: z.string().trim().min(1)
});

export const roleIdParamSchema = z.object({
  id: z.string().uuid()
});

export const roleQuerySchema = z.object({
  scope: z.enum(["panel", "client"]).optional()
});

export const createRoleSchema = z.object({
  name: z.string().trim().min(2),
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores are allowed"),
  scope: z.enum(["panel", "client"]).default("panel"),
  permissionIds: z.array(z.string().uuid()).default([])
});

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    permissionIds: z.array(z.string().uuid()).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

export const deleteRoleSchema = z.object({
  replacementRoleSlug: z.string().trim().min(1).optional()
});
