import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const envFiles = [".env.local", ".env"];

for (const file of envFiles) {
  const filepath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filepath)) {
    dotenv.config({ path: filepath, override: false });
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  WEB_LOCAL_ORIGIN: z.string().url(),
  WEB_PUBLIC_ORIGIN: z.string().url(),
  SESSION_COOKIE_NAME: z.string().min(1).default("allgym_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().default("owner@allgym.local"),
  BOOTSTRAP_ADMIN_NAME: z.string().min(1).default("All Gym Owner")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const allowedOrigins = [env.WEB_LOCAL_ORIGIN, env.WEB_PUBLIC_ORIGIN];
