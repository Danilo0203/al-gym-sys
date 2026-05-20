#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const DEFAULT_DATABASE = process.env.PGDATABASE || "algym";
const DEFAULT_CONFIG = {
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: DEFAULT_DATABASE,
};

function parseMigrationFilename(filename) {
  const match = filename.match(/^(\d{8}_\d{6})_(.+)\.sql$/);
  if (!match) {
    throw new Error(`Invalid migration filename: ${filename}`);
  }

  return {
    version: match[1],
    name: match[2],
  };
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function getMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((filename) => filename.endsWith(".sql"))
    .sort()
    .map((filename) => {
      const filepath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filepath, "utf8");
      const parsed = parseMigrationFilename(filename);
      return {
        filename,
        filepath,
        sql,
        checksum: sha256(sql),
        ...parsed,
      };
    });
}

async function tableExists(client, tableName) {
  const query = `
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = $1
    ) as exists
  `;
  const result = await client.query(query, [tableName]);
  return Boolean(result.rows[0]?.exists);
}

async function appliedVersions(client) {
  const exists = await tableExists(client, "schema_migrations");
  if (!exists) {
    return new Set();
  }

  const result = await client.query("select version from public.schema_migrations");
  return new Set(result.rows.map((row) => row.version));
}

async function insertMigrationRecord(client, migration) {
  await client.query(
    `
      insert into public.schema_migrations (version, name, checksum, result)
      values ($1, $2, $3, 'applied')
      on conflict (version) do nothing
    `,
    [migration.version, migration.filename, migration.checksum],
  );
}

async function validateConnection(client) {
  const result = await client.query(`
    select
      version() as version,
      current_database() as database,
      current_user as current_user
  `);
  return result.rows[0];
}

async function validateTables(client, tableNames) {
  const result = await client.query(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
      order by table_name
    `,
    [tableNames],
  );

  const found = new Set(result.rows.map((row) => row.table_name));
  return tableNames.map((tableName) => ({
    table: tableName,
    exists: found.has(tableName),
  }));
}

async function validateFunction(client, functionName) {
  const result = await client.query(
    `
      select
        p.proname as function_name,
        pg_get_function_identity_arguments(p.oid) as arguments
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = $1
      order by p.proname
    `,
    [functionName],
  );

  return result.rows.map((row) => ({
    function_name: row.function_name,
    arguments: row.arguments,
  }));
}

async function loadSchemaMigrations(client) {
  const exists = await tableExists(client, "schema_migrations");
  if (!exists) {
    return [];
  }

  const result = await client.query(`
    select version, name, checksum, result, applied_at
    from public.schema_migrations
    order by version
  `);
  return result.rows;
}

async function run() {
  const client = new Client(DEFAULT_CONFIG);
  const migrations = getMigrationFiles();
  const summary = {
    database: DEFAULT_DATABASE,
    connection: null,
    applied: [],
    skipped: [],
    validations: {
      tables: [],
      functions: [],
      schema_migrations: [],
    },
  };

  try {
    await client.connect();
    summary.connection = await validateConnection(client);

    let knownAppliedVersions = await appliedVersions(client);

    for (const migration of migrations) {
      if (knownAppliedVersions.has(migration.version)) {
        summary.skipped.push({
          version: migration.version,
          filename: migration.filename,
        });
        continue;
      }

      await client.query(migration.sql);

      if (await tableExists(client, "schema_migrations")) {
        await insertMigrationRecord(client, migration);
      }

      knownAppliedVersions = await appliedVersions(client);
      summary.applied.push({
        version: migration.version,
        filename: migration.filename,
        checksum: migration.checksum,
      });
    }

    summary.validations.tables = await validateTables(client, [
      "schema_migrations",
      "users",
      "user_sessions",
      "password_reset_tokens",
      "audit_log",
    ]);
    summary.validations.functions = await validateFunction(client, "get_user_permissions");
    summary.validations.schema_migrations = await loadSchemaMigrations(client);

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.end().catch(() => {});
  }
}

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error.message,
        code: error.code || null,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
