import { http, HttpResponse } from 'msw';

const API = 'http://localhost:8080';

/**
 * Default happy-path handlers for the full backend surface the app talks to.
 *
 * Tests override individual routes with `server.use(...)` to exercise error
 * paths (401, 402, 500, network failure) rather than editing this file.
 */
export const handlers = [
  // --- auth ---
  http.post(`${API}/auth/check-email`, () => HttpResponse.json({ exists: true })),

  // --- credits ---
  http.get(`${API}/credits/balance`, () => HttpResponse.json({ balance: 1000, currency: 'credits' })),
  http.get(`${API}/credits/packs`, () => HttpResponse.json({ packs: [] })),
  http.post(`${API}/credits/purchase`, () => HttpResponse.json({ checkout_url: 'https://checkout.test/session' })),
  http.get(`${API}/credits/transactions`, () => HttpResponse.json({ transactions: [] })),
  http.get(`${API}/credits/usage`, () => HttpResponse.json({ usage: [] })),

  // --- models / voices / languages ---
  http.get(`${API}/models/:kind`, () => HttpResponse.json({ models: [] })),
  http.get(`${API}/models/:kind/plugins`, () => HttpResponse.json({ plugins: [] })),
  http.get(`${API}/voices/:kind`, () => HttpResponse.json({ voices: [] })),
  http.get(`${API}/voices/:kind/:provider`, () => HttpResponse.json({ voices: [] })),
  http.get(`${API}/languages`, () => HttpResponse.json({ languages: [] })),
  http.get(`${API}/languages/:kind`, () => HttpResponse.json({ languages: [] })),
  http.get(`${API}/languages/:kind/:provider`, () => HttpResponse.json({ languages: [] })),

  // --- channels / telephony ---
  http.get(`${API}/channels/kwamis/:kwamiId`, () => HttpResponse.json({ channels: [] })),
  http.get(`${API}/channels/phone/search`, () => HttpResponse.json({ numbers: [] })),
  http.post(`${API}/channels/phone/purchase`, () => HttpResponse.json({ ok: true })),
  http.post(`${API}/channels/phone/release`, () => HttpResponse.json({ ok: true })),
  http.post(`${API}/channels/whatsapp/configure`, () => HttpResponse.json({ ok: true })),
  http.post(`${API}/channels/calls/outbound`, () => HttpResponse.json({ ok: true })),
  http.post(`${API}/channels/calls/twilio-direct`, () => HttpResponse.json({ ok: true })),
  http.post(`${API}/channels/messages/outbound`, () => HttpResponse.json({ ok: true })),

  // --- email ---
  http.post(`${API}/email/check-username`, () => HttpResponse.json({ available: true })),
  http.post(`${API}/email/activate`, () => HttpResponse.json({ id: 'acct-1', username: 'test', email_address: 'test@kwami.io', is_active: true })),
  http.get(`${API}/email/inbox`, () => HttpResponse.json({ messages: [], total: 0 })),
  http.get(`${API}/email/unread-counts`, () => HttpResponse.json({ counts: {} })),
  http.get(`${API}/email/messages/:id`, ({ params }) => HttpResponse.json({ id: params.id, subject: '', body: '' })),
  http.patch(`${API}/email/messages/:id`, () => HttpResponse.json({ ok: true })),
  http.post(`${API}/email/send`, () => HttpResponse.json({ ok: true })),

  // --- calendar ---
  http.get(`${API}/calendar/events`, () => HttpResponse.json({ events: [] })),
  http.post(`${API}/calendar/events`, () => HttpResponse.json({ id: 'evt-1' })),
  http.patch(`${API}/calendar/events/:id`, () => HttpResponse.json({ ok: true })),
  http.delete(`${API}/calendar/events/:id`, () => HttpResponse.json({ ok: true })),

  // --- contacts ---
  http.get(`${API}/contacts`, () => HttpResponse.json({ contacts: [] })),
  http.post(`${API}/contacts`, () => HttpResponse.json({ id: 'contact-1' })),
  http.patch(`${API}/contacts/:id`, () => HttpResponse.json({ ok: true })),

  // --- wallets ---
  http.get(`${API}/wallets/kwamis/:kwamiId`, () => HttpResponse.json({ wallet: null })),
  http.post(`${API}/wallets/kwamis/:kwamiId`, () => HttpResponse.json({ address: 'So11111111111111111111111111111111111111112' })),
  http.post(`${API}/wallets/kwamis/:kwamiId/fund/:route`, () => HttpResponse.json({ ok: true })),
  http.post(`${API}/wallets/allowlist`, () => HttpResponse.json({ ok: true })),

  // --- memory ---
  http.get(`${API}/memory/:uid/:resource`, () => HttpResponse.json({ items: [], has_more: false })),
  http.post(`${API}/memory/:uid/:action`, () => HttpResponse.json({ ok: true })),
  http.patch(`${API}/memory/:uid/:kind/:uuid`, () => HttpResponse.json({ ok: true })),
  http.delete(`${API}/memory/:uid/:kind/:uuid`, () => HttpResponse.json({ ok: true })),
  http.delete(`${API}/memory/:uid`, () => HttpResponse.json({ ok: true })),
];

/** Helper for error-path tests: `server.use(errorOnce('get', '/credits/balance', 401))`. */
export function errorOnce(method: 'get' | 'post' | 'patch' | 'delete', path: string, status: number, body: unknown = { detail: 'error' }) {
  return http[method](`${API}${path}`, () => HttpResponse.json(body, { status }), { once: true });
}
