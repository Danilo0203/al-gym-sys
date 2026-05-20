import type { PoolClient } from "pg";
import argon2 from "argon2";
import { env } from "../../config/env";
import { query, withTransaction } from "../../db/client";
import { createOpaqueToken, sha256 } from "../../utils/crypto";
import { HttpError } from "../../utils/http-error";
import { insertAuditLog } from "../../utils/audit";

type DbUser = {
  id: string;
  email: string;
  password_hash: string;
  status: "active" | "disabled" | "locked";
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

export type AuthContext = {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  roleScope: string | null;
  permissions: string[];
  isOwner: boolean;
  mustChangePassword: boolean;
};

export type SessionContext = {
  sessionId: string;
  auth: AuthContext;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isBootstrapOwner(email: string) {
  return normalizeEmail(email) === normalizeEmail(env.BOOTSTRAP_ADMIN_EMAIL);
}

async function getUserByEmail(client: PoolClient, email: string) {
  const result = await client.query<DbUser>(
    `
      select
        id,
        email,
        password_hash,
        status,
        must_change_password,
        created_at::text,
        updated_at::text,
        last_login_at::text
      from public.users
      where lower(email) = lower($1)
      limit 1
    `,
    [email]
  );

  return result.rows[0] ?? null;
}

async function getUserById(client: PoolClient, userId: string) {
  const result = await client.query<DbUser>(
    `
      select
        id,
        email,
        password_hash,
        status,
        must_change_password,
        created_at::text,
        updated_at::text,
        last_login_at::text
      from public.users
      where id = $1
      limit 1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
}

async function buildAuthContext(client: PoolClient, user: DbUser): Promise<AuthContext> {
  const permissionsResult = await client.query<{ permissions: string[] | null; role_scope: string | null }>(
    `
      select
        public.get_user_permissions($1::uuid) as permissions,
        public.get_user_role_scope($1::uuid) as role_scope
    `,
    [user.id]
  );

  const permissions = permissionsResult.rows[0]?.permissions ?? [];
  const roleScope = permissionsResult.rows[0]?.role_scope ?? null;
  const bootstrapOwner = isBootstrapOwner(user.email);

  return {
    userId: user.id,
    email: user.email,
    fullName: bootstrapOwner ? env.BOOTSTRAP_ADMIN_NAME : null,
    role: bootstrapOwner ? "owner" : "user",
    roleScope: roleScope ?? (bootstrapOwner ? "panel" : null),
    permissions,
    isOwner: bootstrapOwner,
    mustChangePassword: user.must_change_password
  };
}

function getSessionExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + env.SESSION_TTL_HOURS);
  return expiresAt;
}

async function recordFailedLoginAudit(input: {
  email: string;
  requestId: string;
  ipAddress: string | null;
  reason: string;
  userId?: string;
}) {
  await withTransaction(async (client) => {
    await insertAuditLog(client, {
      actorUserId: input.userId ?? null,
      module: "auth",
      action: "login_failed",
      entityType: "user",
      entityId: input.userId ?? null,
      requestId: input.requestId,
      payload: {
        email: input.email,
        reason: input.reason,
        ipAddress: input.ipAddress
      }
    });
  });
}

export async function createSessionAndLoginAudit(input: {
  email: string;
  password: string;
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const normalizedEmail = normalizeEmail(input.email);

  const lookupResult = await query<DbUser>(
    `
      select
        id,
        email,
        password_hash,
        status,
        must_change_password,
        created_at::text,
        updated_at::text,
        last_login_at::text
      from public.users
      where lower(email) = lower($1)
      limit 1
    `,
    [normalizedEmail]
  );

  const user = lookupResult.rows[0] ?? null;
  if (!user) {
    await recordFailedLoginAudit({
      email: normalizedEmail,
      requestId: input.requestId,
      ipAddress: input.ipAddress,
      reason: "user_not_found"
    });
    throw new HttpError(401, "invalid_credentials", "Invalid credentials");
  }

  const passwordOk = await argon2.verify(user.password_hash, input.password);
  if (!passwordOk) {
    await recordFailedLoginAudit({
      userId: user.id,
      email: normalizedEmail,
      requestId: input.requestId,
      ipAddress: input.ipAddress,
      reason: "invalid_password"
    });
    throw new HttpError(401, "invalid_credentials", "Invalid credentials");
  }

  if (user.status !== "active") {
    await recordFailedLoginAudit({
      userId: user.id,
      email: normalizedEmail,
      requestId: input.requestId,
      ipAddress: input.ipAddress,
      reason: `status_${user.status}`
    });
    throw new HttpError(403, "user_inactive", "User is not active");
  }

  return withTransaction(async (client) => {
    const rawSessionToken = createOpaqueToken();
    const csrfToken = createOpaqueToken(16);
    const sessionTokenHash = sha256(rawSessionToken);
    const expiresAt = getSessionExpiryDate();

    const sessionResult = await client.query<{ id: string }>(
      `
        insert into public.user_sessions (
          user_id,
          session_token_hash,
          csrf_token,
          ip_address,
          user_agent,
          expires_at
        )
        values ($1, $2, $3, $4, $5, $6)
        returning id
      `,
      [user.id, sessionTokenHash, csrfToken, input.ipAddress, input.userAgent, expiresAt.toISOString()]
    );

    await client.query(
      `
        update public.users
        set last_login_at = now(),
            updated_at = now()
        where id = $1
      `,
      [user.id]
    );

    await insertAuditLog(client, {
      actorUserId: user.id,
      module: "auth",
      action: "login_success",
      entityType: "user",
      entityId: user.id,
      requestId: input.requestId,
      payload: {
        email: user.email,
        ipAddress: input.ipAddress
      }
    });

    const refreshedUser = await getUserById(client, user.id);
    if (!refreshedUser) {
      throw new HttpError(500, "login_failed", "User could not be reloaded after login");
    }

    return {
      sessionId: sessionResult.rows[0].id,
      sessionToken: rawSessionToken,
      expiresAt,
      auth: await buildAuthContext(client, refreshedUser)
    };
  });
}

export async function getSessionContext(sessionToken: string): Promise<SessionContext | null> {
  const sessionTokenHash = sha256(sessionToken);
  const result = await query<{
    session_id: string;
    user_id: string;
    email: string;
    password_hash: string;
    status: "active" | "disabled" | "locked";
    must_change_password: boolean;
    created_at: string;
    updated_at: string;
    last_login_at: string | null;
  }>(
    `
      select
        s.id as session_id,
        u.id as user_id,
        u.email,
        u.password_hash,
        u.status,
        u.must_change_password,
        u.created_at::text,
        u.updated_at::text,
        u.last_login_at::text
      from public.user_sessions s
      join public.users u on u.id = s.user_id
      where s.session_token_hash = $1
        and s.revoked_at is null
        and s.expires_at > now()
      limit 1
    `,
    [sessionTokenHash]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  await query(
    `
      update public.user_sessions
      set last_seen_at = now()
      where id = $1
    `,
    [row.session_id]
  );

  const user: DbUser = {
    id: row.user_id,
    email: row.email,
    password_hash: row.password_hash,
    status: row.status,
    must_change_password: row.must_change_password,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at
  };

  return {
    sessionId: row.session_id,
    auth: await withTransaction(async (client) => buildAuthContext(client, user))
  };
}

export async function logoutSession(input: {
  sessionId: string;
  requestId: string;
  actorUserId: string;
  sessionToken?: string | null;
}) {
  await withTransaction(async (client) => {
    await client.query(
      `
        update public.user_sessions
        set revoked_at = now()
        where id = $1
      `,
      [input.sessionId]
    );

    await insertAuditLog(client, {
      actorUserId: input.actorUserId,
      module: "auth",
      action: "logout",
      entityType: "session",
      entityId: input.sessionId,
      requestId: input.requestId,
      payload: {
        sessionTokenPresent: Boolean(input.sessionToken)
      }
    });
  });
}
