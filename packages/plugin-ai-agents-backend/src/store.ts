import { Knex } from 'knex';
import { InvocationRecord } from './types';

type DbRow = {
  id: number;
  entity_ref: string;
  user_ref: string | null;
  session_id: string;
  prompt: string;
  status: 'ok' | 'error';
  response_text: string | null;
  error_message: string | null;
  latency_ms: number | null;
  created_at: string;
};

function toRecord(row: DbRow): InvocationRecord {
  return {
    id: row.id,
    entityRef: row.entity_ref,
    userRef: row.user_ref,
    sessionId: row.session_id,
    prompt: row.prompt,
    status: row.status,
    responseText: row.response_text,
    errorMessage: row.error_message,
    latencyMs: row.latency_ms,
    createdAt: row.created_at,
  };
}

export class InvocationStore {
  private constructor(private readonly db: Knex) {}

  static async create(knex: Knex): Promise<InvocationStore> {
    if (!knex) throw new Error('Knex instance is required to create InvocationStore');
    const exists = await knex.schema.hasTable('invocations');
    if (!exists) {
      await knex.schema.createTable('invocations', table => {
        table.increments('id').primary();
        table.string('entity_ref').notNullable().index();
        table.string('user_ref', 200).nullable();
        table.string('session_id', 80).notNullable();
        table.text('prompt').notNullable();
        table.enum('status', ['ok', 'error']).notNullable();
        table.text('response_text').nullable();
        table.text('error_message').nullable();
        table.bigInteger('latency_ms').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable().index();
      });
    }
    return new InvocationStore(knex);
  }

  async insert(rec: InvocationRecord): Promise<number> {
    const [id] = await this.db('invocations')
      .insert({
        entity_ref: rec.entityRef,
        user_ref: rec.userRef ?? null,
        session_id: rec.sessionId,
        prompt: rec.prompt,
        status: rec.status,
        response_text: rec.responseText ?? null,
        error_message: rec.errorMessage ?? null,
        latency_ms: rec.latencyMs ?? null,
        created_at: new Date(),
      })
      .returning('id');
    return typeof id === 'object' ? id.id : id;
  }

  async listForEntity(entityRef: string, limit = 20): Promise<InvocationRecord[]> {
    const rows: DbRow[] = await this.db('invocations')
      .where({ entity_ref: entityRef })
      .orderBy('created_at', 'desc')
      .limit(limit);
    return rows.map(toRecord);
  }

  async get(id: number): Promise<InvocationRecord | undefined> {
    const rows: DbRow[] = await this.db('invocations').where({ id });
    return rows.length ? toRecord(rows[0]) : undefined;
  }
}
