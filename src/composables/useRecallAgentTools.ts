import { useI18n } from 'vue-i18n';
import type { Kwami } from 'kwami';
import { useMemoryStore, type MemoryEdge, type MemoryNodeRecord } from '@/stores/memory';
import { useTranscriptionState } from '@/composables/useTranscriptionState';
import { useAgentActionState } from '@/composables/useAgentActionState';

/**
 * Client tools for correcting what the Kwami remembers, and for moving around
 * past conversations.
 *
 * The agent already has `recall_memories` and `remember_fact`, so reading and
 * writing memory were covered. Nothing could **un**-remember: the memory
 * panel has delete, merge-duplicates and wipe-everything buttons and no tool
 * reached any of them. "Forget that, it is wrong" is one of the most natural
 * things anyone says to something that remembers, and it was the one thing
 * that could only be done by hand.
 *
 * Everything destructive here goes through the app's own confirmation with no
 * model-supplied bypass, for the reason spelled out at length in
 * `useCommsAgentTools.confirmOutbound`. Forgetting is irreversible and the
 * user cannot undo it without help.
 */

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown error';
}

/** What a memory item is called when read back to the user. */
function edgeLabel(edge: MemoryEdge): string {
  return edge.fact || edge.name || edge.uuid || '';
}

function nodeLabel(node: MemoryNodeRecord): string {
  return node.name || node.summary || node.uuid || '';
}

export function useRecallAgentTools() {
  const { t } = useI18n();
  const memoryStore = useMemoryStore();
  const transcription = useTranscriptionState();
  const actionState = useAgentActionState();

  function confirmDestructive(title: string, message: string): Promise<boolean> {
    return actionState.requestConfirmation({
      title,
      message,
      confirmLabel: t('recall.confirmApply'),
      cancelLabel: t('recall.confirmCancel'),
    });
  }

  // ---------------------------------------------------------------------------
  // Memory
  // ---------------------------------------------------------------------------

  async function ensureMemoryLoaded(): Promise<string | null> {
    if (memoryStore.nodes.length || memoryStore.edges.length) return null;
    try {
      await memoryStore.load();
      return null;
    } catch (error) {
      return t('recall.memoryLoadFailed', { error: getErrorMessage(error) });
    }
  }

  type Hit =
    { kind: 'fact'; uuid: string; label: string } | { kind: 'entity'; uuid: string; label: string };

  /**
   * Find the one memory the user means.
   *
   * Searches facts and entities together, because the user does not know
   * which is which -- "forget that I like coffee" is a fact, "forget about
   * Marcus" is an entity, and nobody says it that way. Refuses on ambiguity
   * rather than picking, which matters more here than anywhere else in the
   * app: the wrong choice deletes something that cannot be recovered and the
   * user will not find out until the Kwami fails to know it.
   */
  function findMemories(query: string): Hit[] {
    const needle = normalizeKey(query);
    if (!needle) return [];

    const hits: Hit[] = [];
    for (const edge of memoryStore.edges) {
      const label = edgeLabel(edge);
      if (edge.uuid && label && normalizeKey(label).includes(needle)) {
        hits.push({ kind: 'fact', uuid: edge.uuid, label });
      }
    }
    for (const node of memoryStore.nodes) {
      const label = nodeLabel(node);
      if (node.uuid && label && normalizeKey(label).includes(needle)) {
        hits.push({ kind: 'entity', uuid: node.uuid, label });
      }
    }
    return hits;
  }

  async function listMemories(query: unknown) {
    const failure = await ensureMemoryLoaded();
    if (failure) return { success: false, message: failure };

    const search = asString(query).trim();
    const hits = search
      ? findMemories(search)
      : [
          ...memoryStore.edges
            .filter((e) => e.uuid)
            .map((e) => ({ kind: 'fact' as const, uuid: e.uuid!, label: edgeLabel(e) })),
          ...memoryStore.nodes
            .filter((n) => n.uuid)
            .map((n) => ({ kind: 'entity' as const, uuid: n.uuid!, label: nodeLabel(n) })),
        ];

    return {
      success: true,
      memories: hits.slice(0, 40).map((h) => ({ kind: h.kind, text: h.label })),
      total: hits.length,
      message: hits.length
        ? t('recall.memoriesFound', { count: hits.length })
        : t('recall.noMemories'),
    };
  }

  async function forgetMemory(query: unknown) {
    const search = asString(query).trim();
    if (!search) return { success: false, message: t('recall.forgetQueryRequired') };

    const failure = await ensureMemoryLoaded();
    if (failure) return { success: false, message: failure };

    const hits = findMemories(search);
    if (!hits.length) {
      return {
        success: false,
        forgotten: false,
        message: t('recall.memoryNotFound', { query: search }),
      };
    }
    if (hits.length > 1) {
      return {
        success: false,
        forgotten: false,
        candidates: hits.slice(0, 5).map((h) => h.label),
        message: t('recall.memoryAmbiguous', {
          query: search,
          list: hits
            .slice(0, 5)
            .map((h) => h.label)
            .join('; '),
        }),
      };
    }

    const hit = hits[0]!;
    const approved = await confirmDestructive(
      t('recall.confirmForgetTitle'),
      t('recall.confirmForgetBody', { text: hit.label }),
    );
    if (!approved) {
      return {
        success: false,
        cancelled: true,
        forgotten: false,
        message: t('recall.forgetCancelled'),
      };
    }

    try {
      if (hit.kind === 'fact') await memoryStore.deleteEdge(hit.uuid);
      else await memoryStore.deleteNode(hit.uuid);
      // Reload so a second "forget that" does not match the same item again
      // from a stale list and report a confusing not-found.
      await memoryStore.load();
      actionState.recordAction(t('recall.actionForgot'), hit.label, { announce: true });
      return {
        success: true,
        forgotten: true,
        text: hit.label,
        message: t('recall.forgot', { text: hit.label }),
      };
    } catch (error) {
      return {
        success: false,
        forgotten: false,
        message: t('recall.forgetFailed', { error: getErrorMessage(error) }),
      };
    }
  }

  async function forgetEverything() {
    const approved = await confirmDestructive(
      t('recall.confirmForgetAllTitle'),
      t('recall.confirmForgetAllBody'),
    );
    if (!approved) {
      return {
        success: false,
        cancelled: true,
        forgotten: false,
        message: t('recall.forgetAllCancelled'),
      };
    }

    try {
      const result = await memoryStore.deleteAll();
      actionState.recordAction(t('recall.actionForgotAll'), undefined, { announce: true });
      return {
        success: true,
        forgotten: true,
        deletedThreads: result.deleted_threads ?? null,
        message: t('recall.forgotAll'),
      };
    } catch (error) {
      return {
        success: false,
        forgotten: false,
        message: t('recall.forgetFailed', { error: getErrorMessage(error) }),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Past conversations
  // ---------------------------------------------------------------------------

  function sessionList() {
    return transcription.sessionsForKwami.value.map((session, index) => ({
      position: index + 1,
      id: session.id,
      title: transcription.sessionTitle(session.createdAt),
      messages: session.messages.length,
      live: session.id === transcription.liveSessionId.value,
    }));
  }

  function listConversations() {
    const sessions = sessionList();
    return {
      success: true,
      sessions,
      viewing: transcription.viewingHistoryId.value,
      message: sessions.length
        ? t('recall.sessionsFound', { count: sessions.length })
        : t('recall.noSessions'),
    };
  }

  /**
   * Resolve a session by position or by the title the user heard.
   *
   * Positions are 1-based and in the order `list_conversations` returned, so
   * "open the second one" means what the user thinks it means.
   */
  function resolveSession(
    which: unknown,
  ): { ok: true; id: string; title: string } | { ok: false; message: string } {
    const sessions = sessionList();
    if (!sessions.length) return { ok: false, message: t('recall.noSessions') };

    if (typeof which === 'number' && Number.isFinite(which)) {
      const index = Math.floor(which) - 1;
      const found = sessions[index];
      if (!found) {
        return {
          ok: false,
          message: t('recall.sessionOutOfRange', {
            position: Math.floor(which),
            count: sessions.length,
          }),
        };
      }
      return { ok: true, id: found.id, title: found.title };
    }

    const target = asString(which).trim();
    if (!target) return { ok: false, message: t('recall.sessionTargetRequired') };

    const byId = sessions.find((s) => s.id === target);
    if (byId) return { ok: true, id: byId.id, title: byId.title };

    const needle = normalizeKey(target);
    const matches = sessions.filter((s) => normalizeKey(s.title).includes(needle));
    if (!matches.length)
      return { ok: false, message: t('recall.sessionNotFound', { name: target }) };
    if (matches.length > 1) {
      return {
        ok: false,
        message: t('recall.sessionAmbiguous', {
          name: target,
          list: matches
            .slice(0, 5)
            .map((s) => s.title)
            .join('; '),
        }),
      };
    }
    return { ok: true, id: matches[0]!.id, title: matches[0]!.title };
  }

  function openConversation(which: unknown) {
    const resolved = resolveSession(which);
    if (!resolved.ok) return { success: false, message: resolved.message };

    transcription.openHistorySession(resolved.id);
    actionState.recordAction(t('recall.actionOpenedSession'), resolved.title, { announce: true });
    return {
      success: true,
      id: resolved.id,
      title: resolved.title,
      // The panel is now showing history rather than what is being said now,
      // which the user needs telling or the next live reply looks missing.
      viewingHistory: true,
      message: t('recall.openedSession', { title: resolved.title }),
    };
  }

  function returnToLive() {
    if (!transcription.viewingHistoryId.value) {
      return { success: true, viewingHistory: false, message: t('recall.alreadyLive') };
    }
    transcription.returnToLiveView();
    return { success: true, viewingHistory: false, message: t('recall.returnedLive') };
  }

  async function deleteConversation(which: unknown) {
    const resolved = resolveSession(which);
    if (!resolved.ok) return { success: false, message: resolved.message };

    const approved = await confirmDestructive(
      t('recall.confirmDeleteSessionTitle'),
      t('recall.confirmDeleteSessionBody', { title: resolved.title }),
    );
    if (!approved) {
      return {
        success: false,
        cancelled: true,
        deleted: false,
        message: t('recall.deleteSessionCancelled'),
      };
    }

    transcription.deleteHistorySession(resolved.id);
    actionState.recordAction(t('recall.actionDeletedSession'), resolved.title, { announce: true });
    return {
      success: true,
      deleted: true,
      title: resolved.title,
      message: t('recall.deletedSession', { title: resolved.title }),
    };
  }

  async function clearTranscript() {
    const approved = await confirmDestructive(
      t('recall.confirmClearTitle'),
      t('recall.confirmClearBody'),
    );
    if (!approved) {
      return {
        success: false,
        cancelled: true,
        cleared: false,
        message: t('recall.clearCancelled'),
      };
    }
    transcription.clearMessages();
    actionState.recordAction(t('recall.actionCleared'), undefined, { announce: true });
    return { success: true, cleared: true, message: t('recall.cleared') };
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  function registerRecallTools(instance: Kwami) {
    instance.registerTool({
      name: 'list_memories',
      description: t('recall.toolDescListMemories'),
      parameters: { query: { type: 'string' } },
      handler: async ({ query }) => listMemories(query),
    });

    instance.registerTool({
      name: 'forget_memory',
      description: t('recall.toolDescForgetMemory'),
      parameters: { query: { type: 'string' } },
      handler: async ({ query }) => forgetMemory(query),
    });

    instance.registerTool({
      name: 'forget_everything',
      description: t('recall.toolDescForgetEverything'),
      parameters: {},
      handler: async () => forgetEverything(),
    });

    instance.registerTool({
      name: 'list_conversations',
      description: t('recall.toolDescListConversations'),
      parameters: {},
      handler: async () => listConversations(),
    });

    instance.registerTool({
      name: 'open_conversation',
      description: t('recall.toolDescOpenConversation'),
      parameters: { which: {} },
      handler: async ({ which }) => openConversation(which),
    });

    instance.registerTool({
      name: 'return_to_live_conversation',
      description: t('recall.toolDescReturnToLive'),
      parameters: {},
      handler: async () => returnToLive(),
    });

    instance.registerTool({
      name: 'delete_conversation',
      description: t('recall.toolDescDeleteConversation'),
      parameters: { which: {} },
      handler: async ({ which }) => deleteConversation(which),
    });

    instance.registerTool({
      name: 'clear_transcript',
      description: t('recall.toolDescClearTranscript'),
      parameters: {},
      handler: async () => clearTranscript(),
    });
  }

  return {
    findMemories,
    listMemories,
    forgetMemory,
    forgetEverything,
    listConversations,
    resolveSession,
    openConversation,
    returnToLive,
    deleteConversation,
    clearTranscript,
    registerRecallTools,
  };
}
