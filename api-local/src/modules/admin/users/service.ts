import argon2 from "argon2";
import type { PoolClient } from "pg";
import { query, withTransaction } from "../../../db/client";
import { HttpError } from "../../../utils/http-error";
import { insertAuditLog } from "../../../utils/audit";

type CurrentUser = {
  userId: string;
  email: string;
  isOwner: boolean;
};

type UserStatus = "active" | "disabled" | "locked";

type UserRow = {
  id: string;
  email: string;
  status: UserStatus;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  full_name: string | null;
  phone: string | null;
  birth_date: string | null;
  avatar_url: string | null;
  role: string | null;
  role_name: string | null;
  role_scope: string | null;
  is_active: boolean;
};

export type UserListItem = UserRow;

export type UserDetail = UserRow & {
  permissions: string[];
};

export type CreateUserInput = {
  email: string;
  full_name: string;
  role: string;
  password: string;
  status: "active" | "disabled";
};

export type UpdateUserInput = {
  id: string;
  email?: string;
  full_name?: string;
  password?: string;
  role?: string;
};

export type UpdateUserStatusInput = {
  id: string;
  status: "active" | "disabled";
};

export type UpdateUserRoleInput = {
  id: string;
  role: string;
};

export type DeleteUserInput = {
  id: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapDbError(error: unknown, fallbackMessage: string): never {
  const code = typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined;
  const message = typeof error === "object" && error !== null ? (error as { message?: string }).message : null;

  if (code === "23505") {
    throw new HttpError(409, "conflict", message || fallbackMessage);
  }

  throw new HttpError(500, "internal_server_error", fallbackMessage);
}

async function getRoleBySlug(client: PoolClient, slug: string) {
  const result = await client.query<{ id: string; slug: string; name: string; scope: string }>(
    `
      select id, slug, name, scope::text as scope
      from public.roles
      where slug = $1
      limit 1
    `,
    [slug]
  );

  return result.rows[0] ?? null;
}

async function getUserByIdRow(client: PoolClient, userId: string) {
  const result = await client.query<UserRow>(
    `
      select
        u.id,
        u.email,
        u.status,
        u.must_change_password,
        u.created_at::text,
        u.updated_at::text,
        u.last_login_at::text,
        p.full_name,
        p.phone,
        p.birth_date::text,
        p.avatar_url,
        p.role::text as role,
        r.name as role_name,
        r.scope::text as role_scope,
        coalesce(p.is_active, u.status = 'active') as is_active
      from public.users u
      left join public.profiles p on p.id = u.id
      left join public.roles r on r.slug = p.role::text
      where u.id = $1
      limit 1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
}

async function getUserDetailRow(client: PoolClient, userId: string): Promise<UserDetail | null> {
  const user = await getUserByIdRow(client, userId);
  if (!user) return null;

  const permissionsResult = await client.query<{ permissions: string[] | null }>(
    `select public.get_user_permissions($1::uuid) as permissions`,
    [userId]
  );

  return {
    ...user,
    permissions: permissionsResult.rows[0]?.permissions ?? []
  };
}

export async function listUsers(): Promise<UserListItem[]> {
  const result = await query<UserRow>(
    `
      select
        u.id,
        u.email,
        u.status,
        u.must_change_password,
        u.created_at::text,
        u.updated_at::text,
        u.last_login_at::text,
        p.full_name,
        p.phone,
        p.birth_date::text,
        p.avatar_url,
        p.role::text as role,
        r.name as role_name,
        r.scope::text as role_scope,
        coalesce(p.is_active, u.status = 'active') as is_active
      from public.users u
      left join public.profiles p on p.id = u.id
      left join public.roles r on r.slug = p.role::text
      order by u.created_at desc, u.email asc
    `
  );

  return result.rows;
}

export async function getUserById(userId: string): Promise<UserDetail | null> {
  const result = await query<UserDetail>(
    `
      select
        u.id,
        u.email,
        u.status,
        u.must_change_password,
        u.created_at::text,
        u.updated_at::text,
        u.last_login_at::text,
        p.full_name,
        p.phone,
        p.birth_date::text,
        p.avatar_url,
        p.role::text as role,
        r.name as role_name,
        r.scope::text as role_scope,
        coalesce(p.is_active, u.status = 'active') as is_active,
        public.get_user_permissions(u.id) as permissions
      from public.users u
      left join public.profiles p on p.id = u.id
      left join public.roles r on r.slug = p.role::text
      where u.id = $1
      limit 1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function createUser(input: CreateUserInput, actor: CurrentUser & { requestId: string }) {
  return withTransaction(async (client) => {
    const role = await getRoleBySlug(client, input.role);
    if (!role) {
      throw new HttpError(400, "invalid_role", "Role not found");
    }

    const passwordHash = await argon2.hash(input.password);

    try {
      const userResult = await client.query<{ id: string }>(
        `
          insert into public.users (
            email,
            password_hash,
            status,
            must_change_password
          )
          values ($1, $2, $3, false)
          returning id
        `,
        [normalizeEmail(input.email), passwordHash, input.status]
      );

      const userId = userResult.rows[0].id;

      await client.query(
        `
          insert into public.profiles (
            id,
            full_name,
            phone,
            birth_date,
            role,
            avatar_url,
            is_active,
            created_at,
            updated_at
          )
          values ($1, $2, '', current_date, $3, null, $4, now(), now())
        `,
        [userId, input.full_name.trim(), input.role, input.status === "active"]
      );

      await insertAuditLog(client, {
        actorUserId: actor.userId,
        module: "users",
        action: "user_created",
        entityType: "user",
        entityId: userId,
        requestId: actor.requestId,
        payload: {
          email: normalizeEmail(input.email),
          fullName: input.full_name.trim(),
          role: input.role,
          status: input.status
        }
      });

      const created = await getUserDetailRow(client, userId);
      if (!created) {
        throw new HttpError(500, "create_user_failed", "User could not be reloaded after creation");
      }

      return created;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      mapDbError(error, "Unable to create user");
    }
  });
}

export async function updateUser(input: UpdateUserInput, actor: CurrentUser & { requestId: string }) {
  return withTransaction(async (client) => {
    const existing = await getUserByIdRow(client, input.id);
    if (!existing) {
      throw new HttpError(404, "not_found", "User not found");
    }

    const nextEmail = input.email ? normalizeEmail(input.email) : null;
    const nextFullName = input.full_name?.trim() ?? null;
    const changes: string[] = [];

    if (nextEmail && nextEmail !== existing.email) {
      await client.query(
        `
          update public.users
          set email = $2,
              updated_at = now()
          where id = $1
        `,
        [input.id, nextEmail]
      );
      changes.push("email");
    }

    if (input.password) {
      const passwordHash = await argon2.hash(input.password);
      await client.query(
        `
          update public.users
          set password_hash = $2,
              updated_at = now()
          where id = $1
        `,
        [input.id, passwordHash]
      );
      changes.push("password");
    }

    if (nextFullName && nextFullName !== existing.full_name) {
      await client.query(
        `
          update public.profiles
          set full_name = $2,
              updated_at = now()
          where id = $1
        `,
        [input.id, nextFullName]
      );
      changes.push("full_name");
    }

    if (input.role && input.role !== existing.role) {
      const nextRole = await getRoleBySlug(client, input.role);
      if (!nextRole) {
        throw new HttpError(400, "invalid_role", "Role not found");
      }

      const profileResult = await client.query(
        `
          update public.profiles
          set role = $2,
              updated_at = now()
          where id = $1
        `,
        [input.id, input.role]
      );

      if (profileResult.rowCount === 0) {
        throw new HttpError(404, "not_found", "User profile not found");
      }

      changes.push("role");
    }

    if (changes.length === 0) {
      return existing;
    }

    await insertAuditLog(client, {
      actorUserId: actor.userId,
      module: "users",
      action: "user_updated",
      entityType: "user",
      entityId: input.id,
      requestId: actor.requestId,
      payload: {
        changes
      }
    });

    if (changes.includes("role")) {
      await insertAuditLog(client, {
        actorUserId: actor.userId,
        module: "users",
        action: "user_role_changed",
        entityType: "user",
        entityId: input.id,
        requestId: actor.requestId,
        payload: {
          previousRole: existing.role,
          nextRole: input.role
        }
      });
    }

    const updated = await getUserDetailRow(client, input.id);
    if (!updated) {
      throw new HttpError(500, "update_user_failed", "User could not be reloaded after update");
    }

    return updated;
  });
}

export async function updateUserStatus(input: UpdateUserStatusInput, actor: CurrentUser & { requestId: string }) {
  return withTransaction(async (client) => {
    const existing = await getUserByIdRow(client, input.id);
    if (!existing) {
      throw new HttpError(404, "not_found", "User not found");
    }

    if (existing.status === input.status) {
      return existing;
    }

    await client.query(
      `
        update public.users
        set status = $2,
            updated_at = now()
        where id = $1
      `,
      [input.id, input.status]
    );

    await client.query(
      `
        update public.profiles
        set is_active = $2,
            updated_at = now()
        where id = $1
      `,
      [input.id, input.status === "active"]
    );

    if (input.status === "disabled") {
      await client.query(
        `
          update public.user_sessions
          set revoked_at = now()
          where user_id = $1
            and revoked_at is null
        `,
        [input.id]
      );
    }

    await insertAuditLog(client, {
      actorUserId: actor.userId,
      module: "users",
      action: input.status === "active" ? "user_reactivated" : "user_deactivated",
      entityType: "user",
      entityId: input.id,
      requestId: actor.requestId,
      payload: {
        previousStatus: existing.status,
        nextStatus: input.status
      }
    });

    const updated = await getUserDetailRow(client, input.id);
    if (!updated) {
      throw new HttpError(500, "update_user_status_failed", "User could not be reloaded after status change");
    }

    return updated;
  });
}

export async function changeUserRole(input: UpdateUserRoleInput, actor: CurrentUser & { requestId: string }) {
  return withTransaction(async (client) => {
    const existing = await getUserByIdRow(client, input.id);
    if (!existing) {
      throw new HttpError(404, "not_found", "User not found");
    }

    const nextRole = await getRoleBySlug(client, input.role);
    if (!nextRole) {
      throw new HttpError(400, "invalid_role", "Role not found");
    }

    if (existing.role === input.role) {
      return existing;
    }

    const profileResult = await client.query(
      `
        update public.profiles
        set role = $2,
            updated_at = now()
        where id = $1
      `,
      [input.id, input.role]
    );

    if (profileResult.rowCount === 0) {
      throw new HttpError(404, "not_found", "User profile not found");
    }

    await client.query(
      `
        update public.users
        set updated_at = now()
        where id = $1
      `,
      [input.id]
    );

    await insertAuditLog(client, {
      actorUserId: actor.userId,
      module: "users",
      action: "user_role_changed",
      entityType: "user",
      entityId: input.id,
      requestId: actor.requestId,
      payload: {
        previousRole: existing.role,
        nextRole: input.role
      }
    });

    const updated = await getUserDetailRow(client, input.id);
    if (!updated) {
      throw new HttpError(500, "update_user_role_failed", "User could not be reloaded after role change");
    }

    return updated;
  });
}

export async function deleteUser(input: DeleteUserInput, actor: CurrentUser & { requestId: string }) {
  return updateUserStatus({ id: input.id, status: "disabled" }, actor);
}
