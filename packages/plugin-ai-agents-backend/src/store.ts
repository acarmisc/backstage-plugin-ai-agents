import path from 'path';
import { Knex } from 'knex';
import { InvocationRecord, ReviewRecord, ReviewsSummary } from './types';

async function runMigrations(knex: Knex): Promise<void> {
  await knex.migrate.latest({ directory: path.join(__dirname, '..', 'migrations') });
}

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
    await runMigrations(knex);
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

type ReviewRow = {
  id: number;
  entity_ref: string;
  user_ref: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

function toReview(row: ReviewRow): ReviewRecord {
  return {
    id: row.id,
    entityRef: row.entity_ref,
    userRef: row.user_ref,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

export class ReviewStore {
  private constructor(private readonly db: Knex) {}

  static async create(knex: Knex): Promise<ReviewStore> {
    if (!knex) throw new Error('Knex instance is required to create ReviewStore');
    await runMigrations(knex);
    return new ReviewStore(knex);
  }

  async insert(rec: ReviewRecord): Promise<number> {
    const [id] = await this.db('agent_reviews')
      .insert({
        entity_ref: rec.entityRef,
        user_ref: rec.userRef ?? null,
        rating: rec.rating,
        comment: rec.comment ?? null,
        created_at: new Date(),
      })
      .returning('id');
    return typeof id === 'object' ? id.id : id;
  }

  async summaryFor(entityRef: string, limit = 50): Promise<ReviewsSummary> {
    const [agg] = (await this.db('agent_reviews')
      .where({ entity_ref: entityRef })
      .count('rating as count')
      .avg('rating as average')) as { count: number | string; average: number | string | null }[];
    const rows: ReviewRow[] = await this.db('agent_reviews')
      .where({ entity_ref: entityRef })
      .orderBy('created_at', 'desc')
      .limit(limit);
    return {
      reviews: rows.map(toReview),
      count: Number(agg?.count ?? 0),
      average:
        agg?.average === null || agg?.average === undefined
          ? null
          : Math.round(Number(agg.average) * 10) / 10,
    };
  }
}
