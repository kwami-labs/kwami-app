/**
 * Avatar Interaction Actions Composable
 *
 * Provides shared interaction action logic for all avatar renderers.
 * Handles click events, state changes, and renderer switching.
 */

import { useKwami } from '@/composables/useKwami';

// =====================================================
// TYPES
// =====================================================

export type InteractionAction =
  | 'none'
  | 'toggleListening'
  | 'startListening'
  | 'stopListening'
  | 'randomize'
  | 'switchRenderer'
  | 'cycleState'
  | 'pulse'
  | 'moveToClick';

export type CursorStyle = 'pointer' | 'grab' | 'crosshair' | 'default';

// =====================================================
// OPTIONS
// =====================================================

export const actionOptions = [
  { label: 'None', value: 'none' },
  { label: 'Toggle Listening', value: 'toggleListening' },
  { label: 'Start Listening', value: 'startListening' },
  { label: 'Stop Listening', value: 'stopListening' },
  { label: 'Randomize', value: 'randomize' },
  { label: 'Switch Renderer', value: 'switchRenderer' },
  { label: 'Cycle State', value: 'cycleState' },
  { label: 'Pulse Effect', value: 'pulse' },
  { label: 'Move to Click', value: 'moveToClick' },
];

export const cursorOptions = [
  { label: 'Pointer', value: 'pointer' },
  { label: 'Grab', value: 'grab' },
  { label: 'Crosshair', value: 'crosshair' },
  { label: 'Default', value: 'default' },
];

// =====================================================
// COMPOSABLE
// =====================================================

export interface UseAvatarInteractionsOptions {
  /** Available renderers for switching */
  renderers?: readonly string[];
  /** Callback to get the current renderer instance for pulse/moveToClick */
  getRenderer?: () => unknown | undefined;
}

export function useAvatarInteractions(options: UseAvatarInteractionsOptions = {}) {
  const { kwami, switchRenderer } = useKwami();

  const defaultRenderers = ['blob-xyz', 'black-hole'] as const;
  const renderers = options.renderers ?? defaultRenderers;

  /**
   * Execute an interaction action
   */
  function executeAction(action: InteractionAction): void {
    if (!kwami.value) return;

    switch (action) {
      case 'none':
        // Do nothing
        break;

      case 'toggleListening': {
        const currentState = kwami.value.getState() || 'idle';
        kwami.value.setState(currentState === 'listening' ? 'idle' : 'listening');
        break;
      }

      case 'startListening':
        kwami.value.setState('listening');
        break;

      case 'stopListening':
        kwami.value.setState('idle');
        break;

      case 'randomize':
        window.dispatchEvent(new CustomEvent('kwami:randomize-avatar-panel'));
        break;

      case 'switchRenderer': {
        const renderer = kwami.value.avatar.getRendererType();
        const currentIdx = renderers.findIndex((r) => r === renderer);
        const nextIdx = (currentIdx + 1) % renderers.length;
        const nextRenderer = renderers[nextIdx] ?? 'blob-xyz';
        switchRenderer(nextRenderer as Parameters<typeof switchRenderer>[0]);
        break;
      }

      case 'cycleState': {
        const states = ['idle', 'listening', 'thinking'] as const;
        const current = kwami.value.getState() || 'idle';
        const currentIndex = states.indexOf(current as (typeof states)[number]);
        const nextIndex = (currentIndex + 1) % states.length;
        const nextState = states[nextIndex] || 'idle';
        kwami.value.setState(nextState);
        window.dispatchEvent(new CustomEvent('kwami:stateChanged', { detail: nextState }));
        break;
      }

      case 'pulse': {
        const renderer = options.getRenderer?.();
        if (
          renderer &&
          typeof (renderer as { triggerPulse?: () => void }).triggerPulse === 'function'
        ) {
          (renderer as { triggerPulse: () => void }).triggerPulse();
        }
        break;
      }

      case 'moveToClick': {
        const renderer = options.getRenderer?.();
        if (
          renderer &&
          typeof (renderer as { moveToPosition?: (x: number, y: number) => void })
            .moveToPosition === 'function'
        ) {
          (renderer as { moveToPosition: (x: number, y: number) => void }).moveToPosition(
            0.2 + Math.random() * 0.6,
            0.2 + Math.random() * 0.6,
          );
        }
        break;
      }
    }
  }

  /**
   * Test an action (alias for executeAction, useful for UI testing buttons)
   */
  function testAction(action: InteractionAction): void {
    executeAction(action);
  }

  return {
    actionOptions,
    cursorOptions,
    executeAction,
    testAction,
  };
}
