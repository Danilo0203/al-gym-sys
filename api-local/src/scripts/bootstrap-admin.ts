import argon2 from "argon2";
import { z } from "zod";
import { env } from "../config/env";
import { pool } from "../db/client";

const bootstrapSchema = z.object({
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8, "BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters")
});

async function main() {
  const parsed = bootstrapSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  const passwordHash = await argon2.hash(parsed.data.BOOTSTRAP_ADMIN_PASSWORD);
  const client = await pool.connect();

  try {
    await client.query("begin");

    const existing = await client.query<{ id: string }>(
      `
        select id
        from public.users
        where lower(email) = lower($1)
        limit 1
      `,
      [env.BOOTSTRAP_ADMIN_EMAIL]
    );

    if (existing.rows[0]) {
      await client.query(
        `
          update public.users
          set password_hash = $2,
              status = 'active',
              must_change_password = false,
              updated_at = now()
          where id = $1
        `,
        [existing.rows[0].id, passwordHash]
      );

      console.log(
        JSON.stringify(
          {
            action: "updated",
            email: env.BOOTSTRAP_ADMIN_EMAIL,
            userId: existing.rows[0].id
          },
          null,
          2
        )
      );
    } else {
      const created = await client.query<{ id: string }>(
        `
          insert into public.users (
            email,
            password_hash,
            status,
            must_change_password
          )
          values ($1, $2, 'active', false)
          returning id
        `,
        [env.BOOTSTRAP_ADMIN_EMAIL, passwordHash]
      );

      console.log(
        JSON.stringify(
          {
            action: "created",
            email: env.BOOTSTRAP_ADMIN_EMAIL,
            userId: created.rows[0].id
          },
          null,
          2
        )
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
