import type { PoolClient } from "pg";

type AuditEventInput = {
  actorUserId?: string | null;
  module: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  requestId?: string | null;
  payload?: unknown;
};

export async function insertAuditLog(client: PoolClient, input: AuditEventInput) {
  await client.query(
    `
      insert into public.audit_log (
        actor_user_id,
        module,
        action,
        entity_type,
        entity_id,
        request_id,
        payload
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      input.actorUserId ?? null,
      input.module,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.requestId ?? null,
      JSON.stringify(input.payload ?? {})
    ]
  );
}
