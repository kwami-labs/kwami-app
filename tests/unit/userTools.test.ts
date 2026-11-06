import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildRequest,
  createWebhookHandler,
  parseUserTools,
  toParametersSchema,
  urlPlaceholders,
  validateUserTool,
  type UserWebhookTool,
} from '@/lib/userTools';

const tool = (over: Partial<UserWebhookTool> = {}): UserWebhookTool => ({
  name: 'get_weather',
  description: 'Weather now.',
  url: 'https://api.example.com/weather',
  method: 'GET',
  params: [{ name: 'city', type: 'string', required: true }],
  ...over,
});

const codes = (t: UserWebhookTool, taken: string[] = [], editing?: string) =>
  validateUserTool(t, new Set(taken), editing).map((i) => i.code);

describe('validateUserTool', () => {
  it('accepts a well-formed tool', () => {
    expect(codes(tool())).toEqual([]);
  });

  // Each of these used to reach the model provider, which rejects the whole
  // request -- every turn of the session -- for one bad tool.
  it.each([
    ['mi herramienta', 'a space'],
    ['búsqueda', 'an accent'],
    ['1st_tool', 'a leading digit'],
    ['a'.repeat(65), '65 characters'],
  ])('refuses the name %s (%s)', (name) => {
    expect(codes(tool({ name }))).toContain('nameInvalid');
  });

  it('refuses a name already taken, except by the tool being edited', () => {
    expect(codes(tool(), ['get_weather', 'send_email'])).toEqual(['nameTaken']);
    expect(codes(tool(), ['get_weather'], 'get_weather')).toEqual([]);
    expect(codes(tool({ name: 'send_email' }), ['send_email'])).toEqual(['nameTaken']);
  });

  it('requires a description: the model decides from it', () => {
    expect(codes(tool({ description: '  ' }))).toEqual(['descriptionRequired']);
  });

  it('wants a full http(s) address, and https unless it is this machine', () => {
    expect(codes(tool({ url: 'example.com/x' }))).toEqual(['urlInvalid']);
    expect(codes(tool({ url: 'ftp://example.com' }))).toEqual(['urlInvalid']);
    expect(codes(tool({ url: 'http://example.com/hook' }))).toEqual(['urlInsecure']);
    expect(codes(tool({ url: 'http://localhost:5678/webhook' }))).toEqual([]);
  });

  it('checks parameter names and duplicates', () => {
    expect(
      codes(
        tool({
          params: [
            { name: 'city', type: 'string', required: true },
            { name: 'city', type: 'string', required: false },
            { name: 'bad name', type: 'string', required: false },
          ],
        }),
      ),
    ).toEqual(['paramDuplicate', 'paramNameInvalid']);
  });

  it('wants a parameter for every placeholder in the address', () => {
    expect(codes(tool({ url: 'https://x.org/{city}/{day}' }))).toEqual(['placeholderUnknown']);
  });
});

describe('toParametersSchema', () => {
  it('builds a JSON Schema the provider accepts, never the {"x": "string"} shorthand', () => {
    expect(
      toParametersSchema(
        tool({
          url: 'https://x.org/{city}',
          params: [
            { name: 'city', type: 'string', required: false, description: ' Name ' },
            { name: 'units', type: 'string', required: true, enum: ['metric', 'imperial'] },
            { name: 'days', type: 'integer', required: false },
          ],
        }),
      ),
    ).toEqual({
      type: 'object',
      properties: {
        city: { type: 'string', description: 'Name' },
        units: { type: 'string', enum: ['metric', 'imperial'] },
        days: { type: 'integer' },
      },
      // `city` is in the path, so it is required whatever the checkbox said.
      required: ['city', 'units'],
      additionalProperties: false,
    });
  });
});

describe('buildRequest', () => {
  it('fills the path, then sends the rest as a query for GET', () => {
    const req = buildRequest(
      { method: 'GET', url: 'https://es.wikipedia.org/api/rest_v1/page/summary/{title}' },
      { title: 'Albert Einstein', lang: 'es' },
    );
    expect(req.url).toBe(
      'https://es.wikipedia.org/api/rest_v1/page/summary/Albert%20Einstein?lang=es',
    );
    expect(req.init.method).toBe('GET');
  });

  it('appends to an address that already has a query', () => {
    const req = buildRequest(
      { method: 'GET', url: 'https://api.open-meteo.com/v1/forecast?current=temperature_2m' },
      { latitude: 40.42, longitude: -3.7 },
    );
    expect(req.url).toBe(
      'https://api.open-meteo.com/v1/forecast?current=temperature_2m&latitude=40.42&longitude=-3.7',
    );
  });

  it('sends the rest as a JSON body for POST', () => {
    const req = buildRequest(
      { method: 'POST', url: 'https://hooks.example.com/{id}' },
      { id: 'abc', text: 'hi', n: 2 },
    );
    expect(req.url).toBe('https://hooks.example.com/abc');
    expect(JSON.parse(req.init.body as string)).toEqual({ text: 'hi', n: 2 });
  });
});

describe('createWebhookHandler', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('hands the agent parsed JSON and the status, without the Kwami token', async () => {
    const fetchMock = vi.fn(async () => new Response('{"temp":21}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await createWebhookHandler({ method: 'GET', url: 'https://x.org/w' })({ q: 1 });
    expect(out).toEqual({ ok: true, status: 200, data: { temp: 21 } });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.stringify(init.headers ?? {})).not.toMatch(/authorization/i);
  });

  it('turns a network failure into words the model can repeat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const out = (await createWebhookHandler({ method: 'POST', url: 'https://x.org' })({})) as {
      ok: boolean;
      error: string;
    };
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/CORS/);
  });
});

describe('parseUserTools', () => {
  it('keeps valid saved tools and drops the rest instead of failing the session', () => {
    expect(
      parseUserTools([
        tool(),
        { ...tool(), name: 'bad name' },
        { ...tool(), name: 'get_weather' }, // duplicate
        'junk',
        { ...tool({ name: 'post_it', method: 'POST' }), params: [{ name: 'x', type: 'weird' }] },
      ]),
    ).toEqual([
      tool(),
      tool({
        name: 'post_it',
        method: 'POST',
        params: [{ name: 'x', type: 'string', required: false }],
      }),
    ]);
    expect(parseUserTools(undefined)).toEqual([]);
  });
});

describe('urlPlaceholders', () => {
  it('lists each placeholder once, in order', () => {
    expect(urlPlaceholders('https://x.org/{a}/{b}?q={a}')).toEqual(['a', 'b']);
  });
});
