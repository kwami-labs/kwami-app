/**
 * The phone, SMS, WhatsApp, contacts and wallet tools.
 *
 * These are the only tools in the app that reach a third party, so the
 * failures worth testing are not "did the handler resolve" but:
 *
 * - **Did it send to the right person?** A name is resolved against the
 *   contact book, and the dangerous outcome is a confident wrong match, not a
 *   miss. Ambiguity must refuse rather than pick.
 * - **Did it ask first?** Every outbound action goes through the app's own
 *   confirmation, and a declined dialog must send nothing.
 * - **Did it tell the truth afterwards?** Nobody can hear an SMS fail, so a
 *   handler that reports the request instead of the result is a handler that
 *   lies to someone who cannot check.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { useCommsAgentTools } from '@/composables/useCommsAgentTools';
import { useContactsStore, type ContactRecord } from '@/stores/contacts';
import { useWorkspaceStore } from '@/stores/workspace';
import { commsAgentToolsEn, commsAgentToolsEs } from '@/i18n/commsAgentTools.locale';

type ToolDef = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const registered = new Map<string, ToolDef>();

/** Whether the app's confirmation dialog is answered yes. Per test. */
const approve = { value: true };
const confirmations: { title: string; message: string }[] = [];

vi.mock('@/composables/useAgentActionState', () => ({
  useAgentActionState: () => ({
    recordAction: vi.fn(),
    recordError: vi.fn(),
    requestConfirmation: vi.fn(async (options: { title: string; message: string }) => {
      confirmations.push(options);
      return approve.value;
    }),
  }),
}));

const api = {
  sendSms: vi.fn(async () => ({ status: 'queued' })),
  sendWhatsapp: vi.fn(async () => ({ status: 'queued' })),
  startCall: vi.fn(async () => ({ status: 'initiated' })),
  channels: vi.fn(async () => ({
    kwami: { id: 'k1', name: 'Kwami', runtimeConfig: {} },
    channels: [
      {
        id: 'c1',
        kwami_id: 'k1',
        kind: 'sms' as const,
        provider: 'twilio',
        status: 'active',
        phone_number: '+15550001111',
      },
    ],
    events: { calls: [], messages: [] },
  })),
  searchNumbers: vi.fn(async () => [
    { phoneNumber: '+15550002222', friendlyName: '(555) 000-2222', region: 'CA' },
  ]),
};

vi.mock('@/composables/useCommunicationsApi', () => ({
  fetchKwamiCommunications: (...a: unknown[]) => api.channels(...(a as [])),
  searchKwamiNumbers: (...a: unknown[]) => api.searchNumbers(...(a as [])),
  sendSmsMessage: (...a: unknown[]) => api.sendSms(...(a as [])),
  sendWhatsappMessage: (...a: unknown[]) => api.sendWhatsapp(...(a as [])),
  startOutboundCall: (...a: unknown[]) => api.startCall(...(a as [])),
}));

const Host = defineComponent({
  setup() {
    const { registerCommsTools } = useCommsAgentTools();
    registerCommsTools({
      registerTool: (def: ToolDef) => registered.set(def.name, def),
    } as never);
    return () => h('div');
  },
});

function call(name: string, args: Record<string, unknown> = {}) {
  const tool = registered.get(name);
  if (!tool) throw new Error(`tool ${name} was never registered`);
  return tool.handler(args);
}

function contact(over: Partial<ContactRecord> & { display_name: string }): ContactRecord {
  return {
    id: over.id ?? `id-${over.display_name}`,
    kwami_id: 'k1',
    phone_number: '+15551234567',
    whatsapp_address: null,
    email: null,
    instagram: null,
    tiktok: null,
    metadata: {},
    created_at: '',
    updated_at: '',
    ...over,
  };
}

/** Stand in for the contacts API, so tests drive the book directly. */
function seedContacts(records: ContactRecord[]) {
  const store = useContactsStore();
  store.fetchContacts = vi.fn(async (search = '') => {
    const needle = search.trim().toLowerCase();
    store.contacts = needle
      ? records.filter((r) => r.display_name.toLowerCase().includes(needle))
      : records;
  }) as typeof store.fetchContacts;
  store.createContact = vi.fn(async () => {}) as typeof store.createContact;
  store.updateContact = vi.fn(async () => {}) as typeof store.updateContact;
  store.deleteContact = vi.fn(async () => {}) as typeof store.deleteContact;
  return store;
}

beforeEach(() => {
  registered.clear();
  confirmations.length = 0;
  approve.value = true;
  vi.clearAllMocks();
  api.sendSms.mockResolvedValue({ status: 'queued' });
  api.sendWhatsapp.mockResolvedValue({ status: 'queued' });
  api.startCall.mockResolvedValue({ status: 'initiated' });
  localStorage.clear();
  setActivePinia(createPinia());
  useWorkspaceStore().activeWorkspaceId = 'k1';
  mount(Host);
});

describe('registration', () => {
  it('registers a tool for every comms panel the UI has', () => {
    for (const name of [
      'list_phone_channels',
      'search_phone_numbers',
      'send_sms',
      'send_whatsapp_message',
      'place_call',
      'list_contacts',
      'find_contact',
      'create_contact',
      'update_contact',
      'delete_contact',
      'get_wallet_summary',
    ]) {
      expect(registered.has(name), `${name} is missing`).toBe(true);
    }
  });

  it('gives every tool a resolved description rather than a key path', () => {
    for (const [name, def] of registered) {
      expect(def.description, `${name} has no description`).toBeTruthy();
      expect(def.description, `${name} description is an i18n key`).not.toMatch(/^comms\./);
    }
  });

  it('offers no tool that can move money', () => {
    // The wallet is read-only by design: a misheard amount on a voice channel
    // is irreversible, so funding stays a deliberate click in the panel.
    for (const name of registered.keys()) {
      expect(name).not.toMatch(/transfer|withdraw|send_funds|fund|purchase|buy/);
    }
  });
});

describe('recipient resolution', () => {
  it('sends to a spoken number without consulting the contact book', async () => {
    const store = seedContacts([contact({ display_name: 'Ana' })]);
    const result = await call('send_sms', { to: '+1 555 987 6543', body: 'hi' });
    expect(result.success).toBe(true);
    // Resolving a literal number against contacts would let a partial digit
    // match silently rewrite the recipient.
    expect(store.fetchContacts).not.toHaveBeenCalled();
    expect(api.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({ toNumber: '+15559876543' }),
    );
  });

  it('resolves a name to that contact number', async () => {
    seedContacts([contact({ display_name: 'Ana', phone_number: '+15551112222' })]);
    const result = await call('send_sms', { to: 'Ana', body: 'hi' });
    expect(result.success).toBe(true);
    expect(api.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({ toNumber: '+15551112222' }),
    );
  });

  it('refuses rather than picking when two contacts match', async () => {
    seedContacts([
      contact({ display_name: 'Ana Gil', phone_number: '+1111' }),
      contact({ display_name: 'Ana Ruiz', phone_number: '+2222' }),
    ]);
    const result = await call('send_sms', { to: 'Ana', body: 'hi' });
    expect(result.success).toBe(false);
    expect(api.sendSms).not.toHaveBeenCalled();
    // The candidates go back so the model can ask, rather than guessing.
    expect(String(result.message)).toContain('Ana Gil');
    expect(String(result.message)).toContain('Ana Ruiz');
  });

  it('takes an exact name over a longer one that also contains it', async () => {
    seedContacts([
      contact({ display_name: 'Ana', phone_number: '+1111' }),
      contact({ display_name: 'Ana Maria', phone_number: '+2222' }),
    ]);
    const result = await call('send_sms', { to: 'Ana', body: 'hi' });
    expect(result.success).toBe(true);
    expect(api.sendSms).toHaveBeenCalledWith(expect.objectContaining({ toNumber: '+1111' }));
  });

  it('refuses an unknown name', async () => {
    seedContacts([contact({ display_name: 'Ana' })]);
    const result = await call('send_sms', { to: 'Bartholomew', body: 'hi' });
    expect(result.success).toBe(false);
    expect(api.sendSms).not.toHaveBeenCalled();
  });

  it('prefers a saved WhatsApp address over the phone number', async () => {
    seedContacts([
      contact({ display_name: 'Ana', phone_number: '+1111', whatsapp_address: '+9999' }),
    ]);
    await call('send_whatsapp_message', { to: 'Ana', body: 'hi' });
    expect(api.sendWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ toNumber: '+9999' }),
    );
  });
});

describe('confirmation', () => {
  it('sends nothing when the user declines', async () => {
    seedContacts([contact({ display_name: 'Ana' })]);
    approve.value = false;
    const result = await call('send_sms', { to: 'Ana', body: 'hi' });
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(result.sent).toBe(false);
    expect(api.sendSms).not.toHaveBeenCalled();
  });

  it('cannot be bypassed by the model claiming it already confirmed', async () => {
    seedContacts([contact({ display_name: 'Ana' })]);
    approve.value = false;
    // Elsewhere in the app a tool accepts confirm: true from the model. For
    // anything aimed at a third party that would make the model its own gate.
    const result = await call('send_sms', { to: 'Ana', body: 'hi', confirm: true });
    expect(result.success).toBe(false);
    expect(api.sendSms).not.toHaveBeenCalled();
  });

  it('reads the message and the recipient back in the dialog', async () => {
    seedContacts([contact({ display_name: 'Ana', phone_number: '+15551234567' })]);
    await call('send_sms', { to: 'Ana', body: 'running late' });
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0]!.message).toContain('running late');
    expect(confirmations[0]!.message).toContain('Ana');
    // The digits are what let the user catch a wrong-contact match.
    expect(confirmations[0]!.message).toContain('4567');
  });

  it('shows the full number before placing a call', async () => {
    seedContacts([contact({ display_name: 'Mum', phone_number: '+15550004417' })]);
    await call('place_call', { to: 'Mum' });
    expect(confirmations[0]!.message).toContain('+15550004417');
  });

  it('does not call when the user declines', async () => {
    seedContacts([contact({ display_name: 'Mum' })]);
    approve.value = false;
    const result = await call('place_call', { to: 'Mum' });
    expect(result.cancelled).toBe(true);
    expect(api.startCall).not.toHaveBeenCalled();
  });

  it('confirms before deleting a contact', async () => {
    const store = seedContacts([contact({ display_name: 'Ana' })]);
    approve.value = false;
    const result = await call('delete_contact', { contact: 'Ana' });
    expect(result.cancelled).toBe(true);
    expect(store.deleteContact).not.toHaveBeenCalled();
  });
});

describe('reporting the result, not the request', () => {
  it('reports a carrier rejection as a failure', async () => {
    seedContacts([contact({ display_name: 'Ana' })]);
    api.sendSms.mockRejectedValueOnce(new Error('carrier rejected the number'));
    const result = await call('send_sms', { to: 'Ana', body: 'hi' });
    expect(result.success).toBe(false);
    expect(result.accepted).toBe(false);
    expect(String(result.message)).toContain('carrier rejected the number');
  });

  it('distinguishes accepted for delivery from delivered', async () => {
    seedContacts([contact({ display_name: 'Ana' })]);
    const result = await call('send_sms', { to: 'Ana', body: 'hi' });
    // `accepted` is the provider taking it, which is not the recipient
    // having read it; the description tells the model to say the difference.
    expect(result.accepted).toBe(true);
    expect(result.providerStatus).toBe('queued');
  });

  it('reports a call as dialling rather than connected', async () => {
    seedContacts([contact({ display_name: 'Mum' })]);
    const result = await call('place_call', { to: 'Mum' });
    expect(result.dialling).toBe(true);
    expect(result.connected).toBeUndefined();
  });

  it('reports a failed call honestly', async () => {
    seedContacts([contact({ display_name: 'Mum' })]);
    api.startCall.mockRejectedValueOnce(new Error('no voice channel'));
    const result = await call('place_call', { to: 'Mum' });
    expect(result.success).toBe(false);
    expect(result.dialling).toBe(false);
  });
});

describe('contacts', () => {
  it('merges an update instead of replacing the record', async () => {
    const store = seedContacts([
      contact({
        display_name: 'Ana',
        phone_number: '+15551112222',
        email: 'ana@example.com',
        whatsapp_address: '+15559998888',
      }),
    ]);
    await call('update_contact', { contact: 'Ana', email: 'new@example.com' });
    // The store's own update replaces the whole record, so passing only the
    // changed field would blank the phone number -- unrecoverable, and
    // invisible until somebody needs it.
    expect(store.updateContact).toHaveBeenCalledWith(
      'id-Ana',
      expect.objectContaining({
        displayName: 'Ana',
        phoneNumber: '+15551112222',
        whatsappAddress: '+15559998888',
        email: 'new@example.com',
      }),
    );
  });

  it('refuses an update naming two possible contacts', async () => {
    const store = seedContacts([
      contact({ display_name: 'Ana Gil' }),
      contact({ display_name: 'Ana Ruiz' }),
    ]);
    const result = await call('update_contact', { contact: 'Ana', email: 'x@y.z' });
    expect(result.success).toBe(false);
    expect(store.updateContact).not.toHaveBeenCalled();
  });

  it('refuses an update with nothing to change', async () => {
    seedContacts([contact({ display_name: 'Ana' })]);
    const result = await call('update_contact', { contact: 'Ana' });
    expect(result.success).toBe(false);
  });

  it('requires a number to create a contact', async () => {
    seedContacts([]);
    const result = await call('create_contact', { displayName: 'New Person' });
    expect(result.success).toBe(false);
  });

  it('says whether a lookup was unambiguous', async () => {
    seedContacts([contact({ display_name: 'Ana', phone_number: '+15551112222' })]);
    const result = await call('find_contact', { query: 'Ana' });
    expect(result.success).toBe(true);
    expect(result.unique).toBe(true);
  });
});

describe('channels and numbers', () => {
  it('lists the connected channels', async () => {
    const result = await call('list_phone_channels');
    expect(result.success).toBe(true);
    expect((result.channels as unknown[]).length).toBe(1);
  });

  it('searches numbers but reports that it cannot buy one', async () => {
    const result = await call('search_phone_numbers', { countryCode: 'us' });
    expect(result.success).toBe(true);
    // Provisioning spends real money and is not idempotent, so it stays a
    // deliberate click rather than something a misheard sentence can trigger.
    expect(result.purchasable).toBe(false);
  });

  it('refuses everything when no Kwami is selected', async () => {
    useWorkspaceStore().activeWorkspaceId = '';
    const result = await call('send_sms', { to: '+15551112222', body: 'hi' });
    expect(result.success).toBe(false);
    expect(api.sendSms).not.toHaveBeenCalled();
  });
});

describe('wallet', () => {
  it('reports that it cannot spend', async () => {
    const result = await call('get_wallet_summary');
    expect(result.canSpend ?? false).toBe(false);
  });
});

describe('locale messages', () => {
  const bundles: Record<string, Record<string, unknown>> = {
    en: commsAgentToolsEn,
    es: commsAgentToolsEs,
  };

  function leafKeys(node: unknown, prefix = ''): string[] {
    if (typeof node === 'string') return [prefix];
    if (node && typeof node === 'object') {
      return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        leafKeys(value, prefix ? `${prefix}.${key}` : key),
      );
    }
    return [];
  }

  for (const [locale, bundle] of Object.entries(bundles)) {
    it(`compiles every ${locale} message`, () => {
      const i18n = createI18n({ legacy: false, locale, messages: { [locale]: bundle } });
      for (const key of leafKeys(bundle)) {
        expect(() =>
          i18n.global.t(key, {
            name: 'x', tail: '1234', list: 'x', error: 'x', count: 1, channel: 'sms',
            recipient: 'x', text: 'x', number: 'x', phone: 'x',
          }),
        ).not.toThrow();
      }
    });
  }

  it('describes both locales with the same keys', () => {
    expect(leafKeys(commsAgentToolsEs).sort()).toEqual(leafKeys(commsAgentToolsEn).sort());
  });
});
