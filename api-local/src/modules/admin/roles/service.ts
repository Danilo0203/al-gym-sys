import type { PoolClient } from "pg";
import { query, withTransaction } from "../../../db/client";
import { HttpError } from "../../../utils/http-error";
import { insertAuditLog } from "../../../utils/audit";

type CurrentUser = {
  userId: string;
  email: string;
  isOwner: boolean;
};

export type RoleListItem = {
  id: string;
  slug: string;
  name: string;
  scope: "panel" | "client";
  is_system: boolean;
  is_protected: boolean;
  created_at: string;
  updated_at: string;
  user_count: number;
};

export type PermissionItem = {
  id: string;
  key: string;
  description: string | null;
  module: string;
  action: string;
};

export type RoleDetail = RoleListItem & {
  permissionIds: string[];
};

export type CreateRoleInput = {
  name: string;
  slug: string;
  scope: "panel" | "client";
  permissionIds: string[];
};

export type UpdateRoleInput = {
  id: string;
  name?: string;
  permissionIds?: string[];
};

export type DeleteRoleInput = {
  id: string;
  replacementRoleSlug?: string;
};

function mapDbError(error: unknown, fallbackMessage: string): never {
  const code = typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined;
  const message = typeof error === "object" && error !== null ? (error as { message?: string }).message : null;

  if (code === "23505") {
    throw new HttpError(409, "conflict", message || fallbackMessage);
  }

  throw new HttpError(500, "internal_server_error", fallbackMessage);
}

async function getRoleById(client: PoolClient, roleId: string) {
  const result = await client.query<{ id: string; slug: string; name: string; scope: "panel" | "client"; is_system: boolean; is_protected: boolean; created_at: string; updated_at: string; user_count: number }>(
    `
      select
        r.id,
        r.slug,
        r.name,
        r.scope::text as scope,
        r.is_system,
        r.is_protected,
        r.created_at::text,
        r.updated_at::text,
        count(p.id)::int as user_count
      from public.roles r
      left join public.profiles p on p.role::text = r.slug
      where r.id = $1
      group by r.id
      limit 1
    `,
    [roleId]
  );

  return result.rows[0] ?? null;
}

async function getRoleBySlug(client: PoolClient, slug: string) {
  const result = await client.query<{ id: string; slug: string; name: string; scope: "panel" | "client"; is_system: boolean; is_protected: boolean; created_at: string; updated_at: string; user_count: number }>(
    `
      select
        r.id,
        r.slug,
        r.name,
        r.scope::text as scope,
        r.is_system,
        r.is_protected,
        r.created_at::text,
        r.updated_at::text,
        count(p.id)::int as user_count
      from public.roles r
      left join public.profiles p on p.role::text = r.slug
      where r.slug = $1
      group by r.id
      limit 1
    `,
    [slug]
  );

  return result.rows[0] ?? null;
}

async function getRoleDetail(client: PoolClient, roleId: string): Promise<RoleDetail | null> {
  const role = await getRoleById(client, roleId);
  if (!role) return null;

  const permissionsResult = await client.query<{ permission_id: string }>(
    `
      select permission_id
      from public.role_permissions
      where role_id = $1
      order by permission_id asc
    `,
    [roleId]
  );

  return {
    ...role,
    permissionIds: permissionsResult.rows.map((row) => row.permission_id)
  };
}

export async function listRoles(scope?: "panel" | "client"): Promise<RoleListItem[]> {
  const result = await query<RoleListItem>(
    `
      select
        r.id,
        r.slug,
        r.name,
        r.scope::text as scope,
        r.is_system,
        r.is_protected,
        r.created_at::text,
        r.updated_at::text,
        count(p.id)::int as user_count
      from public.roles r
      left join public.profiles p on p.role::text = r.slug
      where ($1::text is null or r.scope::text = $1)
      group by r.id
      order by r.scope asc, r.created_at asc, r.name asc
    `,
    [scope ?? null]
  );

  return result.rows;
}

export async function listPermissions(): Promise<PermissionItem[]> {
  const result = await query<PermissionItem>(
    `
      select
        id,
        key,
        description,
        module,
        action
      from public.permissions
      order by module asc, action asc, key asc
    `
  );

  return result.rows;
}

export async function getRolePermissions(roleId: string): Promise<string[]> {
  const result = await query<{ permission_id: string }>(
    `
      select permission_id
      from public.role_permissions
      where role_id = $1
      order by permission_id asc
    `,
    [roleId]
  );

  return result.rows.map((row) => row.permission_id);
}

export async function createRole(input: CreateRoleInput, actor: CurrentUser & { requestId: string }) {
  return withTransaction(async (client) => {
    try {
      const result = await client.query<{ id: string }>(
        `
          insert into public.roles (
            slug,
            name,
            scope,
            is_system,
            is_protected
          )
          values ($1, $2, $3, false, false)
          returning id
        `,
        [input.slug, input.name.trim(), input.scope]
      );

      const roleId = result.rows[0].id;

      if (input.permissionIds.length > 0) {
        await client.query(
          `
            insert into public.role_permissions (role_id, permission_id)
            select $1, unnest($2::uuid[])
          `,
          [roleId, input.permissionIds]
        );
      }

      await insertAuditLog(client, {
        actorUserId: actor.userId,
        module: "roles",
        action: "role_created",
        entityType: "role",
        entityId: roleId,
        requestId: actor.requestId,
        payload: {
          slug: input.slug,
          name: input.name.trim(),
          scope: input.scope,
          permissionIds: input.permissionIds
        }
      });

      const created = await getRoleDetail(client, roleId);
      if (!created) {
        throw new HttpError(500, "create_role_failed", "Role could not be reloaded after creation");
      }

      return created;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      mapDbError(error, "Unable to create role");
    }
  });
}

export async function updateRole(input: UpdateRoleInput, actor: CurrentUser & { requestId: string }) {
  return withTransaction(async (client) => {
    const existing = await getRoleById(client, input.id);
    if (!existing) {
      throw new HttpError(404, "not_found", "Role not found");
    }

    if (existing.is_protected && !actor.isOwner) {
      throw new HttpError(403, "forbidden", "Protected roles can only be modified by the owner");
    }

    const changes: string[] = [];

    if (input.name && input.name.trim() !== existing.name) {
      await client.query(
        `
          update public.roles
          set name = $2,
              updated_at = now()
          where id = $1
        `,
        [input.id, input.name.trim()]
      );
      changes.push("name");
    }

    if (input.permissionIds !== undefined) {
      await client.query(
        `delete from public.role_permissions where role_id = $1`,
        [input.id]
      );

      if (input.permissionIds.length > 0) {
        await client.query(
          `
            insert into public.role_permissions (role_id, permission_id)
            select $1, unnest($2::uuid[])
          `,
          [input.id, input.permissionIds]
        );
      }

      await client.query(
        `
          update public.roles
          set updated_at = now()
          where id = $1
        `,
        [input.id]
      );

      changes.push("permissionIds");
    }

    if (changes.length === 0) {
      return existing;
    }

    await insertAuditLog(client, {
      actorUserId: actor.userId,
      module: "roles",
      action: input.permissionIds !== undefined ? "role_permissions_changed" : "role_updated",
      entityType: "role",
      entityId: input.id,
      requestId: actor.requestId,
      payload: {
        changes
      }
    });

    const updated = await getRoleDetail(client, input.id);
    if (!updated) {
      throw new HttpError(500, "update_role_failed", "Role could not be reloaded after update");
    }

    return updated;
  });
}

export async function deleteRole(input: DeleteRoleInput, actor: CurrentUser & { requestId: string }) {
  return withTransaction(async (client) => {
    const existing = await getRoleById(client, input.id);
    if (!existing) {
      throw new HttpError(404, "not_found", "Role not found");
    }

    if (existing.is_protected && !actor.isOwner) {
      throw new HttpError(403, "forbidden", "Protected roles can only be removed by the owner");
    }

    const affectedUsers = await client.query<{ id: string }>(
      `
        select id
        from public.profiles
        where role::text = $1
        order by id asc
      `,
      [existing.slug]
    );

    const affectedCount = affectedUsers.rowCount ?? affectedUsers.rows.length;

    if (affectedCount > 0) {
      if (!input.replacementRoleSlug) {
        throw new HttpError(409, "reassign_required", "REASSIGN_REQUIRED");
      }

      const replacementRole = await getRoleBySlug(client, input.replacementRoleSlug);
      if (!replacementRole) {
        throw new HttpError(400, "invalid_role", "Replacement role not found");
      }

      if (replacementRole.slug === existing.slug) {
        throw new HttpError(400, "invalid_role", "Replacement role must be different");
      }

      for (const user of affectedUsers.rows) {
        await client.query(
          `
            update public.profiles
            set role = $2,
                updated_at = now()
            where id = $1
          `,
          [user.id, input.replacementRoleSlug]
        );

        await client.query(
          `
            update public.users
            set updated_at = now()
            where id = $1
          `,
          [user.id]
        );
      }

      await insertAuditLog(client, {
        actorUserId: actor.userId,
        module: "roles",
        action: "role_users_reassigned",
        entityType: "role",
        entityId: input.id,
        requestId: actor.requestId,
        payload: {
          previousRole: existing.slug,
          replacementRoleSlug: replacementRole.slug,
          affectedUsers: affectedCount
        }
      });
    }

    await client.query(`delete from public.role_permissions where role_id = $1`, [input.id]);
    await client.query(`delete from public.roles where id = $1`, [input.id]);

    await insertAuditLog(client, {
      actorUserId: actor.userId,
      module: "roles",
      action: "role_deleted",
      entityType: "role",
      entityId: input.id,
      requestId: actor.requestId,
      payload: {
        slug: existing.slug
      }
    });
  });
}
