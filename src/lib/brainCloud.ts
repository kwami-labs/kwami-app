import { api } from '@/lib/apiClient';

/**
 * The brain's work beyond a call (`/brain` on the API): where it can work, the work
 * asked from the app, the user's agents, and what the cloud left for the PC.
 *
 * The PC's process does the work while the PC is on. With the cloud allowed, a
 * worker in the cloud carries on while it is off, and the PC brings home what it
 * made the next time it is on (`brain/cloud.py` and `brain/sync.py` in the agent).
 */

export type BrainTarget = 'auto' | 'pc' | 'cloud';
export type BrainWhere = 'pc' | 'cloud' | 'waiting';

export interface BrainPlaces {
  pc: { online: boolean; claude_login: boolean };
  cloud: { online: boolean; enabled: boolean };
  sync: { pending: number };
  /** Who would take work asked for "wherever it can", right now. */
  auto: BrainWhere;
}

export type BrainJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface BrainJobRow {
  id: string;
  kwami_id: string;
  title: string;
  status: BrainJobStatus;
  target: BrainTarget;
  agent_id: string | null;
  progress: string;
  result: string;
  cost_usd: number;
  ran_on: 'pc' | 'cloud' | '';
  created_at: string;
  finished_at: string | null;
}

export type BrainSyncStatus =
  'pending' | 'applying' | 'applied' | 'conflict' | 'failed' | 'discarded';

export interface BrainSyncRow {
  id: string;
  kind: 'files' | 'patch';
  repo: string;
  files: number;
  title: string;
  status: BrainSyncStatus;
  result: string;
  created_at: string;
}

export type BrainEffort = 'low' | 'medium' | 'high';

export interface BrainAgent {
  id: string;
  name: string;
  description: string;
  prompt: string;
  model: string;
  tools: string[];
  effort: BrainEffort;
  target: BrainTarget;
  enabled: boolean;
}

export type BrainAgentFields = Omit<BrainAgent, 'id'>;

export interface QueuedJob {
  id: string;
  thread_id: string;
  target: BrainTarget;
  where: BrainWhere;
}

/** A name the API accepts: lowercase letters, digits and dashes, starting with a letter. */
export const AGENT_NAME = /^[a-z][a-z0-9-]{1,39}$/;

export const brainCloud = {
  places: () => api.get<BrainPlaces>('/brain/where'),
  allowCloud: (enabled: boolean) => api.put<{ enabled: boolean }>('/brain/cloud', { enabled }),

  jobs: async (kwamiId: string) =>
    (await api.get<{ jobs: BrainJobRow[] }>('/brain/jobs', { query: { kwami_id: kwamiId } })).jobs,
  ask: (kwamiId: string, task: string, target: BrainTarget) =>
    api.post<QueuedJob>('/brain/jobs', { kwami_id: kwamiId, task, target }),
  cancel: (jobId: string) => api.post<{ cancelled: boolean }>(`/brain/jobs/${jobId}/cancel`),

  agents: () =>
    api.get<{ agents: BrainAgent[]; models: string[]; tools: string[] }>('/brain/agents'),
  createAgent: (fields: BrainAgentFields) => api.post<BrainAgent>('/brain/agents', fields),
  updateAgent: (id: string, fields: Partial<BrainAgentFields>) =>
    api.put<BrainAgent>(`/brain/agents/${id}`, fields),
  deleteAgent: (id: string) => api.del<void>(`/brain/agents/${id}`),
  runAgent: (id: string, kwamiId: string, task: string) =>
    api.post<QueuedJob>(`/brain/agents/${id}/run`, { kwami_id: kwamiId, task }),

  sync: async () => (await api.get<{ items: BrainSyncRow[] }>('/brain/sync')).items,
  discardSync: (id: string) => api.post<{ discarded: boolean }>(`/brain/sync/${id}/discard`),
};
