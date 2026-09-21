import { useI18n } from 'vue-i18n';
import type { Kwami } from 'kwami';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';
import { useCreditsStore } from '@/stores/credits';
import { useSceneStore } from '@/stores/scene';
import { useAvatarStore } from '@/stores/avatar';
import { useAgentActionState } from '@/composables/useAgentActionState';
import { randomizeAvatarPanel } from '@/composables/avatar/randomizeAvatarPanel';
import { sceneImagePresets } from '@/presets/scene/image-presets';
import { sceneVideoPresets } from '@/presets/scene/video-presets';
import { sceneHdriPresets } from '@/presets/scene/hdri-presets';

/**
 * Client tools for the things that own a Kwami rather than configure one:
 * creating, renaming and deleting them, reading the credit balance, signing
 * out, and "surprise me" appearance rolls.
 *
 * All of this existed in the UI -- the sidebar's new/edit/delete modals, the
 * energy panel, the account panel's sign-out, the dice buttons on the avatar
 * and scene panels -- and none of it was reachable by voice. Asked to make a
 * new Kwami, the agent could only describe the button.
 *
 * Same two rules as `useCommsAgentTools`, for the same reasons:
 * a target is resolved and never guessed, and anything the user cannot undo
 * without help goes through the app's own confirmation with no model-supplied
 * bypass.
 */

const RANDOMIZE_TARGETS = ['avatar', 'scene', 'both'] as const;

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
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

function pick<T>(items: readonly T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

export function useKwamiAdminAgentTools() {
  const { t } = useI18n();
  const workspaceStore = useWorkspaceStore();
  const authStore = useAuthStore();
  const creditsStore = useCreditsStore();
  const sceneStore = useSceneStore();
  const avatarStore = useAvatarStore();
  const actionState = useAgentActionState();

  /**
   * The app's own confirmation dialog, with no `confirm` argument.
   *
   * See the long note in `useCommsAgentTools.confirmOutbound`: the line is
   * reversible-and-self-contained versus irreversible-or-outward-facing, and
   * deleting a Kwami or signing out sits on the wrong side of it. A gate the
   * model can satisfy by asserting it is satisfied is not a gate.
   */
  function confirmDestructive(title: string, message: string): Promise<boolean> {
    return actionState.requestConfirmation({
      title,
      message,
      confirmLabel: t('kwamiAdmin.confirmApply'),
      cancelLabel: t('kwamiAdmin.confirmCancel'),
    });
  }

  /**
   * Find one Kwami by name or id.
   *
   * Refuses on ambiguity rather than picking, which matters more here than
   * for contacts: the wrong choice deletes something.
   */
  function resolveKwami(
    nameOrId: unknown,
  ):
    | { ok: true; workspace: { id: string; name: string } }
    | { ok: false; message: string } {
    const target = asString(nameOrId).trim();
    if (!target) return { ok: false, message: t('kwamiAdmin.targetRequired') };

    const byId = workspaceStore.workspaces.find((w) => w.id === target);
    if (byId) return { ok: true, workspace: { id: byId.id, name: byId.name } };

    const needle = normalizeKey(target);
    const matches = workspaceStore.workspaces.filter((w) =>
      normalizeKey(w.name).includes(needle),
    );
    if (!matches.length) return { ok: false, message: t('kwamiAdmin.notFound', { name: target }) };

    // An exact name match settles what would otherwise be ambiguous.
    const exact = matches.filter((w) => normalizeKey(w.name) === needle);
    const shortlist = exact.length === 1 ? exact : matches;
    if (shortlist.length > 1) {
      return {
        ok: false,
        message: t('kwamiAdmin.ambiguous', {
          name: target,
          list: shortlist.slice(0, 5).map((w) => w.name).join('; '),
        }),
      };
    }

    const found = shortlist[0]!;
    return { ok: true, workspace: { id: found.id, name: found.name } };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async function createKwami(name: unknown, randomize: unknown, activate: unknown) {
    const requested = asString(name).trim();
    try {
      const created = await workspaceStore.addKwami(authStore.userId, {
        name: requested || undefined,
        // Default to a randomised look: "make me a new Kwami" with no further
        // instruction should produce something that looks like a Kwami, not a
        // default grey one the user then has to describe from scratch.
        randomize: randomize === false ? false : true,
      });
      if (activate !== false) workspaceStore.setActive(created.id);

      actionState.recordAction(t('kwamiAdmin.actionCreated'), created.name, { announce: true });
      return {
        success: true,
        id: created.id,
        name: created.name,
        active: activate !== false,
        message: t('kwamiAdmin.created', { name: created.name }),
      };
    } catch (error) {
      return { success: false, message: t('kwamiAdmin.createFailed', { error: getErrorMessage(error) }) };
    }
  }

  async function renameKwami(kwami: unknown, name: unknown) {
    const next = asString(name).trim();
    if (!next) return { success: false, message: t('kwamiAdmin.nameRequired') };

    const resolved = resolveKwami(kwami);
    if (!resolved.ok) return { success: false, message: resolved.message };

    const previous = resolved.workspace.name;
    try {
      // Only the name: `updateKwami` takes a partial, so emoji and colors are
      // left alone rather than reset by omission.
      await workspaceStore.updateKwami(resolved.workspace.id, { name: next }, authStore.userId);
      actionState.recordAction(t('kwamiAdmin.actionRenamed'), next, { announce: true });
      return {
        success: true,
        id: resolved.workspace.id,
        previousName: previous,
        name: next,
        message: t('kwamiAdmin.renamed', { previous, name: next }),
      };
    } catch (error) {
      return { success: false, message: t('kwamiAdmin.renameFailed', { error: getErrorMessage(error) }) };
    }
  }

  async function deleteKwami(kwami: unknown) {
    const resolved = resolveKwami(kwami);
    if (!resolved.ok) return { success: false, message: resolved.message };

    // Deleting the only Kwami leaves the app with nothing to show; the store
    // recreates a blank local one, which is almost never what was meant.
    if (workspaceStore.workspaces.length <= 1) {
      return { success: false, message: t('kwamiAdmin.deleteLast', { name: resolved.workspace.name }) };
    }

    const approved = await confirmDestructive(
      t('kwamiAdmin.confirmDeleteTitle'),
      t('kwamiAdmin.confirmDeleteBody', { name: resolved.workspace.name }),
    );
    if (!approved) {
      return {
        success: false,
        cancelled: true,
        deleted: false,
        message: t('kwamiAdmin.deleteCancelled', { name: resolved.workspace.name }),
      };
    }

    try {
      const removed = await workspaceStore.deleteKwami(resolved.workspace.id, authStore.userId);
      if (!removed) {
        // The store returns false when the database refused, having changed
        // nothing locally -- reporting success here would be a lie the user
        // discovers on their next reload.
        return {
          success: false,
          deleted: false,
          message: t('kwamiAdmin.deleteRefused', { name: resolved.workspace.name }),
        };
      }
      actionState.recordAction(t('kwamiAdmin.actionDeleted'), resolved.workspace.name, {
        announce: true,
      });
      return {
        success: true,
        deleted: true,
        name: resolved.workspace.name,
        message: t('kwamiAdmin.deleted', { name: resolved.workspace.name }),
      };
    } catch (error) {
      return { success: false, deleted: false, message: t('kwamiAdmin.deleteFailed', { error: getErrorMessage(error) }) };
    }
  }

  // ---------------------------------------------------------------------------
  // Credits
  // ---------------------------------------------------------------------------

  async function getCreditBalance() {
    try {
      await creditsStore.loadBalance();
    } catch (error) {
      return { success: false, message: t('kwamiAdmin.creditsFailed', { error: getErrorMessage(error) }) };
    }
    const credits = creditsStore.balanceCredits;
    return {
      success: true,
      credits,
      display: creditsStore.displayBalance,
      hasCredits: creditsStore.hasCredits,
      // Buying more spends real money, so it stays a deliberate click.
      canPurchase: false,
      message: creditsStore.hasCredits
        ? t('kwamiAdmin.creditsBalance', { display: creditsStore.displayBalance })
        : t('kwamiAdmin.creditsEmpty'),
    };
  }

  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------

  async function signOut() {
    if (!authStore.isAuthenticated) {
      return { success: false, signedOut: false, message: t('kwamiAdmin.notSignedIn') };
    }

    const approved = await confirmDestructive(
      t('kwamiAdmin.confirmSignOutTitle'),
      t('kwamiAdmin.confirmSignOutBody'),
    );
    if (!approved) {
      return { success: false, cancelled: true, signedOut: false, message: t('kwamiAdmin.signOutCancelled') };
    }

    try {
      await authStore.signOut();
      return { success: true, signedOut: true, message: t('kwamiAdmin.signedOut') };
    } catch (error) {
      return { success: false, signedOut: false, message: t('kwamiAdmin.signOutFailed', { error: getErrorMessage(error) }) };
    }
  }

  // ---------------------------------------------------------------------------
  // Surprise me
  // ---------------------------------------------------------------------------

  /**
   * Roll a new look.
   *
   * The avatar half is the real thing: it calls the same `randomizeAll` on the
   * active renderer's store that the panel's dice button does.
   *
   * The scene half deliberately is NOT a reimplementation of the scene
   * panel's dice. That logic lives inside `SceneBackground.vue` and reaching
   * into it from here would mean a second copy that drifts. Instead this
   * picks one of the curated backgrounds at random -- the same presets
   * `apply_scene_preset` uses, through the same setters. The description says
   * so, so the model does not promise a kind of randomness it will not get.
   */
  function randomizeAppearance(target: unknown) {
    const requested = normalizeKey(asString(target, 'avatar')) || 'avatar';
    const match = RANDOMIZE_TARGETS.find((item) => normalizeKey(item) === requested);
    if (!match) {
      return {
        success: false,
        message: t('kwamiAdmin.randomizeTargetInvalid', { list: RANDOMIZE_TARGETS.join(', ') }),
      };
    }

    const changed: string[] = [];

    if (match === 'avatar' || match === 'both') {
      // App.vue owns the always-on store-to-renderer watchers, so mutating
      // the store is enough here; the panel need not be open.
      randomizeAvatarPanel();
      changed.push(avatarStore.rendererType);
    }

    let background: string | null = null;
    if (match === 'scene' || match === 'both') {
      const kind = pick(['image', 'video', 'hdri'] as const)!;
      if (kind === 'image') {
        const preset = pick(sceneImagePresets);
        if (preset) {
          sceneStore.setMediaType('image');
          sceneStore.setImageUrl(preset.url);
          background = preset.name;
        }
      } else if (kind === 'video') {
        const preset = pick(sceneVideoPresets);
        if (preset) {
          sceneStore.setMediaType('video');
          sceneStore.setVideoUrl(preset.url);
          background = preset.name;
        }
      } else {
        const preset = pick(sceneHdriPresets);
        if (preset) {
          sceneStore.setMediaType('hdri');
          sceneStore.setHdriUrl(preset.url);
          background = preset.name;
        }
      }
      if (background) changed.push('scene');
    }

    if (!changed.length) {
      return { success: false, message: t('kwamiAdmin.randomizeNothing') };
    }

    actionState.recordAction(t('kwamiAdmin.actionRandomized'), changed.join(', '), {
      announce: true,
    });
    return {
      success: true,
      target: match,
      renderer: avatarStore.rendererType,
      background,
      message: background
        ? t('kwamiAdmin.randomizedWithScene', { background })
        : t('kwamiAdmin.randomized'),
    };
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  function registerKwamiAdminTools(instance: Kwami) {
    instance.registerTool({
      name: 'create_kwami',
      description: t('kwamiAdmin.toolDescCreateKwami'),
      parameters: {
        name: { type: 'string' },
        randomize: { type: 'boolean' },
        activate: { type: 'boolean' },
      },
      handler: async ({ name, randomize, activate }) => createKwami(name, randomize, activate),
    });

    instance.registerTool({
      name: 'rename_kwami',
      description: t('kwamiAdmin.toolDescRenameKwami'),
      parameters: {
        kwami: { type: 'string' },
        name: { type: 'string' },
      },
      handler: async ({ kwami, name }) => renameKwami(kwami, name),
    });

    instance.registerTool({
      name: 'delete_kwami',
      description: t('kwamiAdmin.toolDescDeleteKwami'),
      parameters: {
        kwami: { type: 'string' },
      },
      handler: async ({ kwami }) => deleteKwami(kwami),
    });

    instance.registerTool({
      name: 'get_credit_balance',
      description: t('kwamiAdmin.toolDescGetCreditBalance'),
      parameters: {},
      handler: async () => getCreditBalance(),
    });

    instance.registerTool({
      name: 'sign_out',
      description: t('kwamiAdmin.toolDescSignOut'),
      parameters: {},
      handler: async () => signOut(),
    });

    instance.registerTool({
      name: 'randomize_appearance',
      description: t('kwamiAdmin.toolDescRandomizeAppearance'),
      parameters: {
        target: { type: 'string', enum: [...RANDOMIZE_TARGETS] },
      },
      handler: async ({ target }) => randomizeAppearance(target),
    });
  }

  return {
    RANDOMIZE_TARGETS,
    resolveKwami,
    createKwami,
    renameKwami,
    deleteKwami,
    getCreditBalance,
    signOut,
    randomizeAppearance,
    registerKwamiAdminTools,
  };
}
