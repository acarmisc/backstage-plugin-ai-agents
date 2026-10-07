import type { AgentActivity, RunState } from '../types';

/** What the Activity view knows about one agent right now. */
export interface AgentLive {
  /** `running` when any run is in progress, else the latest run's state. */
  state: RunState;
  running: number;
  /** Most recent sign of life: the newest run start or update. */
  lastSeen?: string;
  /** True once the telemetry reported at least one run. */
  hasRuns: boolean;
}

/** Aggregate state of an agent's runs (shared by the rail and the cards). */
export function aggregateState(activity: AgentActivity): RunState {
  if (activity.runs.some(r => r.state === 'running')) return 'running';
  return activity.runs[0]?.state ?? 'unknown';
}

export function liveFromActivity(activity: AgentActivity): AgentLive {
  let lastSeen: number | undefined;
  for (const run of activity.runs) {
    for (const ts of [run.updatedAt, run.startedAt]) {
      const ms = ts ? Date.parse(ts) : NaN;
      if (Number.isFinite(ms) && (lastSeen === undefined || ms > lastSeen)) {
        lastSeen = ms;
      }
    }
  }
  return {
    state: aggregateState(activity),
    running: activity.runs.filter(r => r.state === 'running').length,
    lastSeen:
      lastSeen === undefined ? undefined : new Date(lastSeen).toISOString(),
    hasRuns: activity.runs.length > 0,
  };
}

/** Live state by entity ref, from the fleet activity. */
export function liveByEntityRef(
  fleet: AgentActivity[] | null | undefined,
): Record<string, AgentLive> {
  const out: Record<string, AgentLive> = {};
  for (const activity of fleet ?? []) {
    out[activity.entityRef] = liveFromActivity(activity);
  }
  return out;
}
