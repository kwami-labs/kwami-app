import { useAgentActionState } from '@/composables/useAgentActionState';
import { useTranscriptionState } from '@/composables/useTranscriptionState';
import { isExpressOrder } from '@/lib/expressOrder';
import { api } from '@/lib/apiClient';
import { useWorkspaceStore } from '@/stores/workspace';

export interface OutboundRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  channel: string;
  recipient: string;
  summary: string;
  /** The user's own words, quoted by the model. See `lib/expressOrder.ts`. */
  expressOrder?: unknown;
}

/** Shared across every tool that sends: one spoken order covers one message, not one per tool. */
let usedTurn: number | null = null;

/** Test seam: the spent turn is module state. */
export function resetOutboundGate(): void {
  usedTurn = null;
}

/**
 * The one gate in front of everything that leaves the app: the dialog, unless the
 * user's latest words expressly waive it.
 *
 * A waived send is written down before it goes. If that record cannot be written
 * the dialog comes back, because a send nobody can trace is what the record is
 * there to prevent.
 */
export function useOutboundGate() {
  const actionState = useAgentActionState();
  const workspaceStore = useWorkspaceStore();
  const { liveMessages } = useTranscriptionState();

  function lastUserTurn() {
    return [...liveMessages.value].reverse().find((m) => m.role === 'user');
  }

  async function allow(request: OutboundRequest): Promise<boolean> {
    const turn = lastUserTurn();
    if (isExpressOrder(request.expressOrder, turn, Date.now(), usedTurn)) {
      try {
        await api.post('/assistant/express-sends', {
          kwami_id: workspaceStore.activeWorkspaceId,
          channel: request.channel,
          recipient: request.recipient,
          summary: request.summary,
          express_order: request.expressOrder,
        });
        usedTurn = turn?.timestamp ?? null;
        return true;
      } catch {
        // Falls through to the dialog.
      }
    }
    return actionState.requestConfirmation({
      title: request.title,
      message: request.message,
      confirmLabel: request.confirmLabel,
      cancelLabel: request.cancelLabel,
    });
  }

  return { allow };
}
