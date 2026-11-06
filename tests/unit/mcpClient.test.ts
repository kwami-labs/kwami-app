import { describe, expect, it, vi } from 'vitest';
import {
  McpClient,
  McpError,
  exposedToolName,
  flattenCallResult,
  sanitizeInputSchema,
} from '@/lib/mcpClient';

type Handler = (body: Record<string, unknown>, init: RequestInit) => Response;

/** A fake MCP endpoint: answers per JSON-RPC method, records every request. */
function server(handlers: Record<string, Handler>) {
  const calls: {
    method: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }[] = [];
  const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
    const body = init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    const method = (body.method as string) ?? init.method ?? '';
    calls.push({ method, headers: init.headers as Record<string, string>, body });
    const handler = handlers[method];
    return handler ? handler(body, init) : new Response(null, { status: 202 });
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls };
}

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const sse = (events: unknown[], headers: Record<string, string> = {}) =>
  new Response(events.map((e) => `event: message\ndata: ${JSON.stringify(e)}\n\n`).join(''), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream', ...headers },
  });

const initResult = (id: unknown, protocolVersion = '2025-06-18') => ({
  jsonrpc: '2.0',
  id,
  result: { protocolVersion, serverInfo: { name: 'Fake', version: '1' }, capabilities: {} },
});

describe('McpClient', () => {
  it('initializes, keeps the session and sends the protocol header afterwards', async () => {
    const { fetchFn, calls } = server({
      initialize: (b) => json(initResult(b.id), { 'Mcp-Session-Id': 'abc' }),
      'tools/list': (b) =>
        json({ jsonrpc: '2.0', id: b.id, result: { tools: [{ name: 'search' }] } }),
    });
    const client = new McpClient({ url: 'https://x.org/mcp', apiKey: 'k', fetch: fetchFn });
    await client.connect();
    expect(client.serverInfo).toEqual({ name: 'Fake', version: '1' });
    expect(await client.listTools()).toEqual([{ name: 'search' }]);

    expect(calls.map((c) => c.method)).toEqual([
      'initialize',
      'notifications/initialized',
      'tools/list',
    ]);
    expect(calls[0].headers.Authorization).toBe('Bearer k');
    expect(calls[0].headers['Mcp-Session-Id']).toBeUndefined();
    expect(calls[0].headers.Accept).toContain('text/event-stream');
    expect(calls[2].headers['Mcp-Session-Id']).toBe('abc');
    expect(calls[2].headers['MCP-Protocol-Version']).toBe('2025-06-18');
  });

  // An older server may not allow the header in CORS; sending it would fail the preflight.
  it('does not send the protocol header to a 2025-03-26 server', async () => {
    const { fetchFn, calls } = server({
      initialize: (b) => sse([initResult(b.id, '2025-03-26')]),
      'tools/list': (b) => sse([{ jsonrpc: '2.0', id: b.id, result: { tools: [] } }]),
    });
    const client = new McpClient({ url: 'https://x.org/mcp', fetch: fetchFn });
    await client.connect();
    await client.listTools();
    expect(calls[2].headers['MCP-Protocol-Version']).toBeUndefined();
  });

  it('reads the answer out of an event stream that carries other messages too', async () => {
    const { fetchFn } = server({
      initialize: (b) => sse([initResult(b.id)]),
      'tools/call': (b) =>
        sse([
          { jsonrpc: '2.0', method: 'notifications/progress', params: {} },
          { jsonrpc: '2.0', id: 999, result: {} },
          { jsonrpc: '2.0', id: b.id, result: { content: [{ type: 'text', text: 'done' }] } },
        ]),
    });
    const client = new McpClient({ url: 'https://x.org/mcp', fetch: fetchFn });
    await client.connect();
    expect(await client.callTool('t', {})).toEqual({ content: [{ type: 'text', text: 'done' }] });
  });

  it('follows tools/list pages', async () => {
    const { fetchFn } = server({
      initialize: (b) => json(initResult(b.id)),
      'tools/list': (b) => {
        const cursor = (b.params as { cursor?: string }).cursor;
        return json({
          jsonrpc: '2.0',
          id: b.id,
          result: cursor
            ? { tools: [{ name: 'b' }] }
            : { tools: [{ name: 'a' }], nextCursor: 'page2' },
        });
      },
    });
    const client = new McpClient({ url: 'https://x.org/mcp', fetch: fetchFn });
    await client.connect();
    expect((await client.listTools()).map((t) => t.name)).toEqual(['a', 'b']);
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [405, 'legacy'],
    [500, 'http'],
  ])('names an HTTP %i at initialize as %s', async (status, kind) => {
    const { fetchFn } = server({ initialize: () => new Response('nope', { status }) });
    const client = new McpClient({ url: 'https://x.org/sse', fetch: fetchFn });
    await expect(client.connect()).rejects.toMatchObject({ kind });
  });

  it('turns a JSON-RPC error into an rpc error', async () => {
    const { fetchFn } = server({
      initialize: (b) => json(initResult(b.id)),
      'tools/call': (b) =>
        json({ jsonrpc: '2.0', id: b.id, error: { code: -32602, message: 'Unknown tool' } }),
    });
    const client = new McpClient({ url: 'https://x.org/mcp', fetch: fetchFn });
    await client.connect();
    await expect(client.callTool('nope', {})).rejects.toMatchObject({
      kind: 'rpc',
      message: 'Unknown tool (-32602)',
    });
  });

  it('calls a CORS refusal a network error', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const client = new McpClient({ url: 'https://x.org/mcp', fetch: fetchFn });
    const error = await client.connect().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(McpError);
    expect((error as McpError).kind).toBe('network');
  });

  it('ends the session on close', async () => {
    const { fetchFn, calls } = server({
      initialize: (b) => json(initResult(b.id), { 'Mcp-Session-Id': 's1' }),
    });
    const client = new McpClient({ url: 'https://x.org/mcp', fetch: fetchFn });
    await client.connect();
    await client.close();
    expect(calls.at(-1)?.method).toBe('DELETE');
    expect(calls.at(-1)?.headers['Mcp-Session-Id']).toBe('s1');
  });
});

describe('sanitizeInputSchema', () => {
  // Every one of these keywords is something a provider has refused, failing
  // the whole request rather than the one tool.
  it('keeps only what every provider accepts', () => {
    expect(
      sanitizeInputSchema({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        additionalProperties: false,
        properties: {
          repo: { type: 'string', description: 'owner/name', format: 'uri', default: 'a/b' },
          tags: { type: 'array' },
          when: { type: ['string', 'null'] },
          mode: { anyOf: [{ type: 'string' }, { type: 'number' }], description: 'Either' },
          nested: { type: 'object', properties: { x: { type: 'integer', minimum: 0 } } },
        },
        required: ['repo', 'ghost'],
      }),
    ).toEqual({
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        tags: { type: 'array', items: { type: 'string' } },
        when: { type: 'string' },
        mode: { type: 'string', description: 'Either' },
        nested: { type: 'object', properties: { x: { type: 'integer' } } },
      },
      required: ['repo'],
    });
  });

  it('gives a tool with no schema an empty object', () => {
    expect(sanitizeInputSchema(undefined)).toEqual({ type: 'string' });
    expect(sanitizeInputSchema({ type: 'object' })).toEqual({ type: 'object', properties: {} });
  });
});

describe('exposedToolName', () => {
  it('prefixes the server and keeps to provider-safe characters', () => {
    expect(exposedToolName('DeepWiki', 'read_wiki_structure')).toBe(
      'deepwiki__read_wiki_structure',
    );
    expect(exposedToolName('Mi Servidor', 'crear-issue.v2')).toBe('mi_servidor__crear_issue_v2');
    expect(exposedToolName('123', 'x')).toBe('m_123__x');
    expect(exposedToolName('s', 'x'.repeat(100))).toHaveLength(64);
  });
});

describe('flattenCallResult', () => {
  it('joins text, names other parts and carries the error flag', () => {
    expect(
      flattenCallResult({
        content: [
          { type: 'text', text: 'one' },
          { type: 'image', mimeType: 'image/png' },
          { type: 'text', text: 'two' },
        ],
        isError: true,
      }),
    ).toEqual({ ok: false, text: 'one\n\n[image image/png]\n\ntwo' });
    expect(flattenCallResult({ structuredContent: { a: 1 } })).toEqual({
      ok: true,
      text: '{"a":1}',
    });
  });
});
