import { useI18n } from 'vue-i18n';
import type { Kwami } from 'kwami';
import { useWorkspaceStore } from '@/stores/workspace';
import { useContactsStore, type ContactRecord } from '@/stores/contacts';
import { useWalletStore } from '@/stores/wallet';
import { useAgentActionState } from '@/composables/useAgentActionState';
import {
  fetchKwamiCommunications,
  searchKwamiNumbers,
  sendSmsMessage,
  sendWhatsappMessage,
  startOutboundCall,
  type ChannelRecord,
} from '@/composables/useCommunicationsApi';

/**
 * Client tools for the phone, SMS, WhatsApp, contacts and wallet panels.
 *
 * These panels have existed and been fully usable by mouse for a while, with
 * no tool behind any of them -- so the agent could open the SMS panel on
 * request and then had no way to send an SMS. By voice that is
 * indistinguishable from the feature not existing.
 *
 * Three rules run through everything here, and each exists because the
 * failure it prevents is one the user cannot see coming:
 *
 * 1. **A recipient is never guessed.** "Text Mum" resolves against the
 *    contact book, and an ambiguous or missing match is an error that lists
 *    the candidates, not a pick. Sending the right message to the wrong
 *    person is the failure that actually happens on a voice channel.
 * 2. **Anything outward-facing goes through the app's own confirmation**,
 *    with no model-supplied bypass. Elsewhere in the app a tool may take
 *    `confirm: true` from the model; for sending and calling that would make
 *    the model its own gate, which is no gate.
 * 3. **The result is reported, not the request.** Nobody can hear an SMS
 *    fail. Every handler returns what the API actually said.
 */

/** Digits, spaces and the usual punctuation, with an optional leading plus. */
const PHONE_SHAPE = /^\+?[\d\s().-]{6,}$/;

function normalizeNumber(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/[^\d+]/g, '');
  return digits;
}

function looksLikeNumber(value: string): boolean {
  return PHONE_SHAPE.test(value.trim());
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

/** The last four digits, for a read-back the user can actually check. */
function tail(number: string): string {
  const digits = number.replace(/\D/g, '');
  return digits.slice(-4);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown error';
}

export interface ResolvedRecipient {
  number: string;
  /** The contact this came from, when it came from one. */
  name: string | null;
  /** How the user should hear it read back before anything is sent. */
  label: string;
}

export function useCommsAgentTools() {
  const { t } = useI18n();
  const workspaceStore = useWorkspaceStore();
  const contactsStore = useContactsStore();
  const walletStore = useWalletStore();
  const actionState = useAgentActionState();

  function activeKwamiId(): string {
    return workspaceStore.activeWorkspaceId;
  }

  function contactLabel(contact: ContactRecord): string {
    return `${contact.display_name} (${contact.phone_number})`;
  }

  /**
   * Turn what the user said into a number we are willing to send to.
   *
   * Returns an error rather than a best guess whenever there is any doubt.
   * `channel` narrows which field of a contact is used, because a contact's
   * WhatsApp address is not always their phone number.
   */
  async function resolveRecipient(
    to: unknown,
    channel: 'sms' | 'whatsapp' | 'voice',
  ): Promise<{ ok: true; recipient: ResolvedRecipient } | { ok: false; message: string }> {
    const raw = asString(to).trim();
    if (!raw) return { ok: false, message: t('comms.recipientRequired') };

    // A number spoken outright is used as given. Resolving it against the
    // contact book as well would let a partial digit match rewrite it.
    if (looksLikeNumber(raw)) {
      const number = normalizeNumber(raw);
      return { ok: true, recipient: { number, name: null, label: number } };
    }

    try {
      await contactsStore.fetchContacts(raw);
    } catch (error) {
      return {
        ok: false,
        message: t('comms.contactLookupFailed', { error: getErrorMessage(error) }),
      };
    }

    const needle = raw.toLowerCase();
    const candidates = contactsStore.contacts.filter((contact) =>
      contact.display_name.toLowerCase().includes(needle),
    );

    if (!candidates.length) {
      return { ok: false, message: t('comms.contactNotFound', { name: raw }) };
    }

    // An exact name match settles what would otherwise be ambiguous: with
    // "Ana" and "Ana Maria" both in the book, "text Ana" means Ana.
    const exact = candidates.filter((c) => c.display_name.toLowerCase() === needle);
    const shortlist = exact.length === 1 ? exact : candidates;

    if (shortlist.length > 1) {
      return {
        ok: false,
        message: t('comms.contactAmbiguous', {
          name: raw,
          list: shortlist.slice(0, 5).map(contactLabel).join('; '),
        }),
      };
    }

    const contact = shortlist[0]!;
    const number =
      channel === 'whatsapp'
        ? contact.whatsapp_address || contact.phone_number
        : contact.phone_number;

    if (!number) {
      return {
        ok: false,
        message: t('comms.contactHasNoNumber', { name: contact.display_name, channel }),
      };
    }

    return {
      ok: true,
      recipient: {
        number: normalizeNumber(number),
        name: contact.display_name,
        // Name and digits together: a wrong-contact match is the failure that
        // actually happens, and the digits are what lets the user catch it.
        label: t('comms.recipientLabel', {
          name: contact.display_name,
          tail: tail(number),
        }),
      },
    };
  }

  /**
   * The app's own confirmation dialog.
   *
   * Deliberately NOT `useWorkspaceAgentTools`'s `confirmIfNeeded`, and please
   * do not "fix" the inconsistency: it is load-bearing.
   *
   * That helper short-circuits on `confirm === true` from the model, so the
   * model can satisfy the gate by asserting it already asked. The dividing
   * line is not important versus unimportant, it is **reversible and
   * self-contained versus irreversible or outward-facing**. Everything that
   * helper gates is the former -- resetting the avatar is visible and undoable,
   * and the cost of a false positive is an annoyed user pressing undo.
   * Everything gated here is the latter: a message or a call has a third party
   * on the other end and no undo, and `delete_contact` cannot be undone by the
   * user without help. For those, a gate the model can satisfy by itself is
   * not a gate.
   *
   * So this takes no `confirm` argument at all, and none of these tools expose
   * one. `tests/unit/commsAgentTools.test.ts` asserts that passing
   * `confirm: true` does not bypass the dialog.
   */
  function confirmOutbound(title: string, message: string): Promise<boolean> {
    return actionState.requestConfirmation({
      title,
      message,
      confirmLabel: t('comms.confirmSend'),
      cancelLabel: t('comms.confirmCancel'),
    });
  }

  function requireKwami(): { ok: true; kwamiId: string } | { ok: false; message: string } {
    const kwamiId = activeKwamiId();
    if (!kwamiId) return { ok: false, message: t('comms.noActiveKwami') };
    return { ok: true, kwamiId };
  }

  // ---------------------------------------------------------------------------
  // Channels
  // ---------------------------------------------------------------------------

  function describeChannel(channel: ChannelRecord) {
    return {
      id: channel.id,
      kind: channel.kind,
      number: channel.phone_number,
      status: channel.status,
      name: channel.display_name ?? null,
    };
  }

  async function listPhoneChannels() {
    const kwami = requireKwami();
    if (!kwami.ok) return { success: false, message: kwami.message };

    try {
      const snapshot = await fetchKwamiCommunications(kwami.kwamiId);
      const channels = snapshot.channels.map(describeChannel);
      return {
        success: true,
        channels,
        message: channels.length
          ? t('comms.channelsFound', { count: channels.length })
          : t('comms.noChannels'),
      };
    } catch (error) {
      return {
        success: false,
        message: t('comms.channelsFailed', { error: getErrorMessage(error) }),
      };
    }
  }

  /**
   * Search available numbers. Deliberately does not buy one.
   *
   * Provisioning spends real money and is not idempotent, so it stays a
   * deliberate click in the phone panel rather than something reachable by
   * saying the wrong sentence near a microphone.
   */
  async function searchPhoneNumbers(
    countryCode: unknown,
    areaCode: unknown,
    contains: unknown,
    limit: unknown,
  ) {
    const kwami = requireKwami();
    if (!kwami.ok) return { success: false, message: kwami.message };

    const country = asString(countryCode).trim().toUpperCase() || 'US';
    try {
      const results = await searchKwamiNumbers(kwami.kwamiId, {
        countryCode: country,
        areaCode: asString(areaCode).trim() || undefined,
        contains: asString(contains).trim() || undefined,
        limit:
          typeof limit === 'number' && Number.isFinite(limit)
            ? Math.min(20, Math.max(1, Math.floor(limit)))
            : 10,
      });
      return {
        success: true,
        numbers: results.map((r) => ({
          number: r.phoneNumber,
          name: r.friendlyName,
          region: r.region ?? null,
          locality: r.locality ?? null,
        })),
        purchasable: false,
        message: results.length
          ? t('comms.numbersFound', { count: results.length })
          : t('comms.noNumbersFound'),
      };
    } catch (error) {
      return {
        success: false,
        message: t('comms.numberSearchFailed', { error: getErrorMessage(error) }),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------

  async function sendMessage(kind: 'sms' | 'whatsapp', to: unknown, body: unknown) {
    const kwami = requireKwami();
    if (!kwami.ok) return { success: false, message: kwami.message };

    const text = asString(body).trim();
    if (!text) return { success: false, message: t('comms.bodyRequired') };

    const resolved = await resolveRecipient(to, kind);
    if (!resolved.ok) return { success: false, message: resolved.message };

    const approved = await confirmOutbound(
      kind === 'sms' ? t('comms.confirmSmsTitle') : t('comms.confirmWhatsappTitle'),
      t('comms.confirmSendBody', { recipient: resolved.recipient.label, text }),
    );
    if (!approved) {
      return {
        success: false,
        cancelled: true,
        sent: false,
        message: t('comms.sendCancelled', { recipient: resolved.recipient.label }),
      };
    }

    try {
      const send = kind === 'sms' ? sendSmsMessage : sendWhatsappMessage;
      const response = (await send({
        kwamiId: kwami.kwamiId,
        toNumber: resolved.recipient.number,
        body: text,
      })) as Record<string, unknown>;

      actionState.recordAction(
        kind === 'sms' ? t('comms.actionSentSms') : t('comms.actionSentWhatsapp'),
        resolved.recipient.label,
        { announce: true },
      );
      return {
        success: true,
        // The provider accepted it for delivery. That is not the same as the
        // recipient having it, and the description tells the model to say so.
        accepted: true,
        recipient: resolved.recipient.label,
        number: resolved.recipient.number,
        providerStatus: (response?.status as string) ?? null,
        message: t('comms.sendAccepted', { recipient: resolved.recipient.label }),
      };
    } catch (error) {
      const detail = getErrorMessage(error);
      actionState.recordError(t('comms.errSend'), detail);
      return {
        success: false,
        accepted: false,
        recipient: resolved.recipient.label,
        message: t('comms.sendFailed', { recipient: resolved.recipient.label, error: detail }),
      };
    }
  }

  /**
   * Place a call.
   *
   * Held to a higher bar than a message on purpose: a text is read later, a
   * call rings a real person's phone, possibly at three in the morning, and
   * cannot be unsent. The confirmation names who and which number.
   */
  async function placeCall(to: unknown) {
    const kwami = requireKwami();
    if (!kwami.ok) return { success: false, message: kwami.message };

    const resolved = await resolveRecipient(to, 'voice');
    if (!resolved.ok) return { success: false, message: resolved.message };

    const approved = await confirmOutbound(
      t('comms.confirmCallTitle'),
      t('comms.confirmCallBody', {
        recipient: resolved.recipient.label,
        number: resolved.recipient.number,
      }),
    );
    if (!approved) {
      return {
        success: false,
        cancelled: true,
        connected: false,
        message: t('comms.callCancelled', { recipient: resolved.recipient.label }),
      };
    }

    try {
      const response = (await startOutboundCall({
        kwamiId: kwami.kwamiId,
        toNumber: resolved.recipient.number,
      })) as Record<string, unknown>;

      actionState.recordAction(t('comms.actionPlacedCall'), resolved.recipient.label, {
        announce: true,
      });
      return {
        success: true,
        // Dialling started. Whether anyone picks up is not knowable here.
        dialling: true,
        recipient: resolved.recipient.label,
        number: resolved.recipient.number,
        providerStatus: (response?.status as string) ?? null,
        message: t('comms.callStarted', { recipient: resolved.recipient.label }),
      };
    } catch (error) {
      const detail = getErrorMessage(error);
      actionState.recordError(t('comms.errCall'), detail);
      return {
        success: false,
        dialling: false,
        recipient: resolved.recipient.label,
        message: t('comms.callFailed', { recipient: resolved.recipient.label, error: detail }),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Contacts
  // ---------------------------------------------------------------------------

  function describeContact(contact: ContactRecord) {
    return {
      id: contact.id,
      name: contact.display_name,
      phone: contact.phone_number,
      whatsapp: contact.whatsapp_address,
      email: contact.email,
    };
  }

  async function listContacts(query: unknown) {
    const kwami = requireKwami();
    if (!kwami.ok) return { success: false, message: kwami.message };

    const search = asString(query).trim();
    try {
      await contactsStore.fetchContacts(search);
      const contacts = contactsStore.contacts.map(describeContact);
      return {
        success: true,
        contacts,
        message: contacts.length
          ? t('comms.contactsFound', { count: contacts.length })
          : t('comms.noContacts'),
      };
    } catch (error) {
      return {
        success: false,
        message: t('comms.contactLookupFailed', { error: getErrorMessage(error) }),
      };
    }
  }

  /**
   * Find one contact, so the model can read a number back before using it.
   *
   * Returns every match rather than picking, for the same reason
   * `resolveRecipient` does.
   */
  async function findContact(query: unknown) {
    const result = await listContacts(query);
    if (!result.success) return result;

    const contacts = (result.contacts ?? []) as ReturnType<typeof describeContact>[];
    if (!contacts.length) {
      return { success: false, message: t('comms.contactNotFound', { name: asString(query) }) };
    }
    return {
      success: true,
      contacts,
      unique: contacts.length === 1,
      message:
        contacts.length === 1
          ? t('comms.contactSingle', { name: contacts[0]!.name, phone: contacts[0]!.phone })
          : t('comms.contactMultiple', { count: contacts.length }),
    };
  }

  async function createContact(
    displayName: unknown,
    phoneNumber: unknown,
    whatsappAddress: unknown,
    email: unknown,
  ) {
    const kwami = requireKwami();
    if (!kwami.ok) return { success: false, message: kwami.message };

    const name = asString(displayName).trim();
    const phone = asString(phoneNumber).trim();
    if (!name) return { success: false, message: t('comms.contactNameRequired') };
    if (!phone) return { success: false, message: t('comms.contactPhoneRequired') };

    try {
      await contactsStore.createContact({
        displayName: name,
        phoneNumber: normalizeNumber(phone),
        whatsappAddress: asString(whatsappAddress).trim() || undefined,
        email: asString(email).trim() || undefined,
      });
      actionState.recordAction(t('comms.actionCreatedContact'), name, { announce: true });
      return {
        success: true,
        name,
        phone: normalizeNumber(phone),
        message: t('comms.contactCreated', { name }),
      };
    } catch (error) {
      return {
        success: false,
        message: t('comms.contactSaveFailed', { error: getErrorMessage(error) }),
      };
    }
  }

  /**
   * Change some fields of a contact, leaving the rest alone.
   *
   * The store's `updateContact` takes a whole record and replaces it, so
   * calling it with only the changed fields would blank everything else. A
   * silently cleared phone number is unrecoverable and invisible until
   * somebody needs it, so this merges over the existing record.
   */
  async function updateContact(
    nameOrId: unknown,
    displayName: unknown,
    phoneNumber: unknown,
    whatsappAddress: unknown,
    email: unknown,
  ) {
    const kwami = requireKwami();
    if (!kwami.ok) return { success: false, message: kwami.message };

    const target = asString(nameOrId).trim();
    if (!target) return { success: false, message: t('comms.contactTargetRequired') };

    let existing: ContactRecord | undefined;
    try {
      await contactsStore.fetchContacts(target);
      const needle = target.toLowerCase();
      const matches = contactsStore.contacts.filter(
        (c) => c.id === target || c.display_name.toLowerCase().includes(needle),
      );
      if (!matches.length) {
        return { success: false, message: t('comms.contactNotFound', { name: target }) };
      }
      if (matches.length > 1) {
        return {
          success: false,
          message: t('comms.contactAmbiguous', {
            name: target,
            list: matches.slice(0, 5).map(contactLabel).join('; '),
          }),
        };
      }
      existing = matches[0]!;
    } catch (error) {
      return {
        success: false,
        message: t('comms.contactLookupFailed', { error: getErrorMessage(error) }),
      };
    }

    const nextName = asString(displayName).trim();
    const nextPhone = asString(phoneNumber).trim();
    const nextWhatsapp = asString(whatsappAddress).trim();
    const nextEmail = asString(email).trim();

    if (!nextName && !nextPhone && !nextWhatsapp && !nextEmail) {
      return { success: false, message: t('comms.contactNothingToChange') };
    }

    try {
      await contactsStore.updateContact(existing.id, {
        displayName: nextName || existing.display_name,
        phoneNumber: nextPhone ? normalizeNumber(nextPhone) : existing.phone_number,
        whatsappAddress: nextWhatsapp || existing.whatsapp_address || undefined,
        email: nextEmail || existing.email || undefined,
      });
      actionState.recordAction(t('comms.actionUpdatedContact'), existing.display_name, {
        announce: true,
      });
      return {
        success: true,
        name: nextName || existing.display_name,
        message: t('comms.contactUpdated', { name: nextName || existing.display_name }),
      };
    } catch (error) {
      return {
        success: false,
        message: t('comms.contactSaveFailed', { error: getErrorMessage(error) }),
      };
    }
  }

  async function deleteContact(nameOrId: unknown) {
    const kwami = requireKwami();
    if (!kwami.ok) return { success: false, message: kwami.message };

    const target = asString(nameOrId).trim();
    if (!target) return { success: false, message: t('comms.contactTargetRequired') };

    let existing: ContactRecord | undefined;
    try {
      await contactsStore.fetchContacts(target);
      const needle = target.toLowerCase();
      const matches = contactsStore.contacts.filter(
        (c) => c.id === target || c.display_name.toLowerCase().includes(needle),
      );
      if (!matches.length) {
        return { success: false, message: t('comms.contactNotFound', { name: target }) };
      }
      if (matches.length > 1) {
        return {
          success: false,
          message: t('comms.contactAmbiguous', {
            name: target,
            list: matches.slice(0, 5).map(contactLabel).join('; '),
          }),
        };
      }
      existing = matches[0]!;
    } catch (error) {
      return {
        success: false,
        message: t('comms.contactLookupFailed', { error: getErrorMessage(error) }),
      };
    }

    const approved = await confirmOutbound(
      t('comms.confirmDeleteContactTitle'),
      t('comms.confirmDeleteContactBody', {
        name: existing.display_name,
        phone: existing.phone_number,
      }),
    );
    if (!approved) {
      return {
        success: false,
        cancelled: true,
        message: t('comms.deleteCancelled', { name: existing.display_name }),
      };
    }

    try {
      await contactsStore.deleteContact(existing.id);
      actionState.recordAction(t('comms.actionDeletedContact'), existing.display_name, {
        announce: true,
      });
      return {
        success: true,
        name: existing.display_name,
        message: t('comms.contactDeleted', { name: existing.display_name }),
      };
    } catch (error) {
      return {
        success: false,
        message: t('comms.contactSaveFailed', { error: getErrorMessage(error) }),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Wallet (read-only on purpose)
  // ---------------------------------------------------------------------------

  /**
   * Report the wallet. Nothing here can move funds.
   *
   * Funding and transfers stay a deliberate action in the wallet panel: a
   * misheard amount on a voice channel is irreversible, and the safe shape
   * for that is the interlocked confirmation the trading tools use, not a
   * dialog bolted onto a read-only summary.
   */
  async function getWalletSummary() {
    const kwami = requireKwami();
    if (!kwami.ok) return { success: false, message: kwami.message };

    try {
      await walletStore.refresh();
    } catch (error) {
      return {
        success: false,
        message: t('comms.walletFailed', { error: getErrorMessage(error) }),
      };
    }

    if (!walletStore.wallet) {
      return { success: true, exists: false, message: t('comms.noWallet') };
    }

    const balances = walletStore.balances.map((b) => ({
      symbol: b.symbol,
      amount: b.amount,
      usd: b.amount_usd ?? null,
    }));
    return {
      success: true,
      exists: true,
      network: walletStore.wallet.network,
      status: walletStore.wallet.status,
      balances,
      canSpend: false,
      message: balances.length
        ? t('comms.walletSummary', {
            list: balances.map((b) => `${b.amount} ${b.symbol}`).join(', '),
          })
        : t('comms.walletEmpty'),
    };
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  function registerCommsTools(instance: Kwami) {
    instance.registerTool({
      name: 'list_phone_channels',
      description: t('comms.toolDescListPhoneChannels'),
      parameters: {},
      handler: async () => listPhoneChannels(),
    });

    instance.registerTool({
      name: 'search_phone_numbers',
      description: t('comms.toolDescSearchPhoneNumbers'),
      parameters: {
        countryCode: { type: 'string' },
        areaCode: { type: 'string' },
        contains: { type: 'string' },
        limit: { type: 'number' },
      },
      handler: async ({ countryCode, areaCode, contains, limit }) =>
        searchPhoneNumbers(countryCode, areaCode, contains, limit),
    });

    instance.registerTool({
      name: 'send_sms',
      description: t('comms.toolDescSendSms'),
      parameters: {
        to: { type: 'string' },
        body: { type: 'string' },
      },
      handler: async ({ to, body }) => sendMessage('sms', to, body),
    });

    instance.registerTool({
      name: 'send_whatsapp_message',
      description: t('comms.toolDescSendWhatsapp'),
      parameters: {
        to: { type: 'string' },
        body: { type: 'string' },
      },
      handler: async ({ to, body }) => sendMessage('whatsapp', to, body),
    });

    instance.registerTool({
      name: 'place_call',
      description: t('comms.toolDescPlaceCall'),
      parameters: {
        to: { type: 'string' },
      },
      handler: async ({ to }) => placeCall(to),
    });

    instance.registerTool({
      name: 'list_contacts',
      description: t('comms.toolDescListContacts'),
      parameters: {
        query: { type: 'string' },
      },
      handler: async ({ query }) => listContacts(query),
    });

    instance.registerTool({
      name: 'find_contact',
      description: t('comms.toolDescFindContact'),
      parameters: {
        query: { type: 'string' },
      },
      handler: async ({ query }) => findContact(query),
    });

    instance.registerTool({
      name: 'create_contact',
      description: t('comms.toolDescCreateContact'),
      parameters: {
        displayName: { type: 'string' },
        phoneNumber: { type: 'string' },
        whatsappAddress: { type: 'string' },
        email: { type: 'string' },
      },
      handler: async ({ displayName, phoneNumber, whatsappAddress, email }) =>
        createContact(displayName, phoneNumber, whatsappAddress, email),
    });

    instance.registerTool({
      name: 'update_contact',
      description: t('comms.toolDescUpdateContact'),
      parameters: {
        contact: { type: 'string' },
        displayName: { type: 'string' },
        phoneNumber: { type: 'string' },
        whatsappAddress: { type: 'string' },
        email: { type: 'string' },
      },
      handler: async ({ contact, displayName, phoneNumber, whatsappAddress, email }) =>
        updateContact(contact, displayName, phoneNumber, whatsappAddress, email),
    });

    instance.registerTool({
      name: 'delete_contact',
      description: t('comms.toolDescDeleteContact'),
      parameters: {
        contact: { type: 'string' },
      },
      handler: async ({ contact }) => deleteContact(contact),
    });

    instance.registerTool({
      name: 'get_wallet_summary',
      description: t('comms.toolDescGetWalletSummary'),
      parameters: {},
      handler: async () => getWalletSummary(),
    });
  }

  return {
    resolveRecipient,
    listPhoneChannels,
    searchPhoneNumbers,
    sendMessage,
    placeCall,
    listContacts,
    findContact,
    createContact,
    updateContact,
    deleteContact,
    getWalletSummary,
    registerCommsTools,
  };
}
