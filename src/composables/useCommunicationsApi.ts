import { api } from '@/lib/apiClient';


export interface ChannelRecord {
  id: string;
  kwami_id: string;
  kind: 'voice_phone' | 'whatsapp' | 'sms';
  provider: string;
  status: string;
  phone_number: string;
  display_name?: string | null;
  provider_sender?: string | null;
  capabilities?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface CallEventRecord {
  id: string;
  provider_call_sid?: string | null;
  from_number?: string | null;
  to_number?: string | null;
  status: string;
  created_at: string;
}

export interface MessageEventRecord {
  id: string;
  provider_message_sid?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  provider_status?: string | null;
  body?: string | null;
  created_at: string;
}

export interface KwamiCommunicationsSnapshot {
  kwami: {
    id: string;
    name: string;
    runtimeConfig: Record<string, unknown>;
  };
  channels: ChannelRecord[];
  events: {
    calls: CallEventRecord[];
    messages: MessageEventRecord[];
  };
}

export interface NumberSearchResult {
  phoneNumber: string;
  friendlyName: string;
  region?: string;
  locality?: string;
  postalCode?: string;
  capabilities?: Record<string, boolean>;
}


export async function fetchKwamiCommunications(kwamiId: string): Promise<KwamiCommunicationsSnapshot> {
  return api.get<KwamiCommunicationsSnapshot>(`/channels/kwamis/${kwamiId}`);
}

export async function searchKwamiNumbers(
  kwamiId: string,
  params: {
    countryCode: string;
    areaCode?: string;
    contains?: string;
    limit?: number;
  },
): Promise<NumberSearchResult[]> {
  const data = await api.get<{ results: NumberSearchResult[] }>('/channels/phone/search', {
    query: {
      kwamiId,
      countryCode: params.countryCode,
      areaCode: params.areaCode,
      contains: params.contains,
      limit: params.limit,
    },
  });
  return data.results;
}

export async function purchaseKwamiNumber(payload: {
  kwamiId: string;
  phoneNumber: string;
  displayName?: string;
  countryCode: string;
}) {
  // Provisioning spends money and is not idempotent.
  return api.post('/channels/phone/purchase', payload, { retry: false, timeoutMs: 30_000 });
}

export async function releaseKwamiPhone(payload: {
  kwamiId: string;
  channelId: string;
  releaseProviderResources?: boolean;
}) {
  return api.post<{
    ok: boolean;
    removedChannelIds: string[];
    provider: Record<string, unknown>;
  }>(
    '/channels/phone/release',
    { ...payload, releaseProviderResources: payload.releaseProviderResources ?? true },
    { retry: false, timeoutMs: 30_000 },
  );
}

export async function configureWhatsappChannel(payload: {
  channelId: string;
  status?: string;
  providerSender?: string;
  metadata?: Record<string, unknown>;
}) {
  return api.post('/channels/whatsapp/configure', payload);
}

export async function startOutboundCall(payload: {
  kwamiId: string;
  toNumber: string;
  channelId?: string;
  waitUntilAnswered?: boolean;
}) {
  // Placing a call is a side effect; waitUntilAnswered can also run long.
  return api.post('/channels/calls/outbound', payload, { retry: false, timeoutMs: 60_000 });
}

/** Twilio REST only — no LiveKit room or agent (for debugging PSTN). */
export async function startTwilioDirectTestCall(payload: {
  kwamiId: string;
  toNumber: string;
  channelId?: string;
}) {
  return api.post('/channels/calls/twilio-direct', payload, { retry: false, timeoutMs: 60_000 });
}

export async function sendWhatsappMessage(payload: {
  kwamiId: string;
  toNumber: string;
  body: string;
  channelId?: string;
}) {
  return api.post(
    '/channels/messages/outbound',
    { ...payload, channelKind: 'whatsapp' },
    { retry: false },
  );
}

export async function sendSmsMessage(payload: {
  kwamiId: string;
  toNumber: string;
  body: string;
  channelId?: string;
}) {
  return api.post(
    '/channels/messages/outbound',
    { ...payload, channelKind: 'sms' },
    { retry: false },
  );
}
