/**
 * A Model Context Protocol client over Streamable HTTP, for the browser.
 *
 * The SDK's `ToolRegistry.connectMCP` is a placeholder -- its client lists no
 * tools and every call returns null -- so the Tools panel showed "Connected"
 * for any address at all and the agent got nothing. This speaks the protocol
 * for real: `initialize`, `notifications/initialized`, `tools/list` (paged)
 * and `tools/call`, with answers as plain JSON or as an SSE stream, the
 * `Mcp-Session-Id` session and the `MCP-Protocol-Version` header.
 *
 * It runs in the page, so the server has to accept the app's origin (CORS),
 * as DeepWiki and GitMCP do. Servers on the older HTTP+SSE transport, which
 * keep a GET stream open and answer on it, are not supported; they fail at
 * `initialize` with a message that says so.
 */

export const MCP_PROTOCOL_VERSION = '2025-06-18';

/** Protocol revisions from which the client must send `MCP-Protocol-Version`. */
const VERSION_HEADER_SINCE = '2025-06-18';

/** Under the agent's 30 s wait for a client tool, so the error reaches the model. */
export const MCP_CALL_TIMEOUT_MS = 25_000;
const MCP_SETUP_TIMEOUT_MS = 15_000;

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpServerInfo {
  name?: string;
  version?: string;
}

export type McpErrorKind =
  'network' | 'http' | 'unauthorized' | 'protocol' | 'rpc' | 'timeout' | 'legacy';

export class McpError extends Error {
  readonly kind: McpErrorKind;
  readonly status?: number;

  constructor(kind: McpErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'McpError';
    this.kind = kind;
    this.status = status;
  }
}

interface RpcResponse {
  jsonrpc: '2.0';
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

type FetchLike = typeof fetch;

export interface McpClientOptions {
  url: string;
  apiKey?: string;
  fetch?: FetchLike;
  clientVersion?: string;
}

/** Parse a `text/event-stream` body and return the JSON-RPC message answering `id`. */
async function readSseResponse(res: Response, id: number): Promise<RpcResponse> {
  const body = res.body;
  if (!body) throw new McpError('protocol', 'Empty event stream');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const take = (block: string): RpcResponse | null => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!data) return null;
    try {
      const message = JSON.parse(data) as RpcResponse;
      return message && message.id === id ? message : null;
    } catch {
      return null;
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      // Events end with a blank line; keep the unfinished tail for the next chunk.
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = done ? '' : (blocks.pop() ?? '');
      for (const block of done ? blocks.concat(buffer) : blocks) {
        const found = take(block);
        if (found) return found;
      }
      if (done) break;
    }
  } finally {
    // The server may keep the stream open for notifications we do not want.
    reader.cancel().catch(() => {});
  }
  throw new McpError('protocol', 'The event stream ended without an answer');
}

function versionAtLeast(version: string, floor: string): boolean {
  return version >= floor; // ISO dates compare as strings
}

export class McpClient {
  private readonly url: string;
  private readonly apiKey?: string;
  private readonly fetchFn: FetchLike;
  private readonly clientVersion: string;
  private sessionId: string | null = null;
  private protocolVersion: string | null = null;
  private nextId = 1;
  serverInfo: McpServerInfo = {};
  instructions?: string;

  constructor(options: McpClientOptions) {
    this.url = options.url;
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetch ?? ((...args) => fetch(...args));
    this.clientVersion = options.clientVersion ?? '1.0.0';
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
    // Only to servers that negotiated a revision requiring it: an older server
    // may not list it in its CORS allowed headers, and the preflight would fail.
    if (this.protocolVersion && versionAtLeast(this.protocolVersion, VERSION_HEADER_SINCE)) {
      headers['MCP-Protocol-Version'] = this.protocolVersion;
    }
    return headers;
  }

  private async post(body: unknown, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.fetchFn(this.url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new McpError('timeout', `No answer within ${Math.round(timeoutMs / 1000)} s`);
      }
      // fetch rejects with a bare TypeError for CORS refusals and unreachable
      // hosts alike; the browser does not say which.
      throw new McpError('network', e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }
  }

  private async request<T>(method: string, params: unknown, timeoutMs: number): Promise<T> {
    const id = this.nextId++;
    const res = await this.post({ jsonrpc: '2.0', id, method, params }, timeoutMs);

    if (res.status === 401 || res.status === 403) {
      throw new McpError('unauthorized', `HTTP ${res.status}`, res.status);
    }
    if (method === 'initialize' && (res.status === 404 || res.status === 405)) {
      throw new McpError('legacy', `HTTP ${res.status}`, res.status);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new McpError(
        'http',
        `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        res.status,
      );
    }

    const session = res.headers.get('Mcp-Session-Id');
    if (session) this.sessionId = session;

    const type = res.headers.get('Content-Type') ?? '';
    let message: RpcResponse;
    if (type.includes('text/event-stream')) {
      message = await readSseResponse(res, id);
    } else {
      try {
        message = (await res.json()) as RpcResponse;
      } catch {
        throw new McpError('protocol', 'The answer was not JSON');
      }
    }
    if (message.error) {
      throw new McpError('rpc', `${message.error.message} (${message.error.code})`);
    }
    return message.result as T;
  }

  private async notify(method: string): Promise<void> {
    const res = await this.post({ jsonrpc: '2.0', method }, MCP_SETUP_TIMEOUT_MS);
    // 202 Accepted is the expected answer; anything ok is fine.
    if (!res.ok && res.status !== 202) {
      throw new McpError('http', `HTTP ${res.status}`, res.status);
    }
  }

  async connect(): Promise<void> {
    const result = await this.request<{
      protocolVersion?: string;
      serverInfo?: McpServerInfo;
      instructions?: string;
    }>(
      'initialize',
      {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'kwami', version: this.clientVersion },
      },
      MCP_SETUP_TIMEOUT_MS,
    );
    if (!result || typeof result !== 'object') {
      throw new McpError('protocol', 'initialize returned nothing');
    }
    this.protocolVersion = result.protocolVersion ?? MCP_PROTOCOL_VERSION;
    this.serverInfo = result.serverInfo ?? {};
    this.instructions = result.instructions;
    await this.notify('notifications/initialized');
  }

  async listTools(): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    let cursor: string | undefined;
    // A bound on pages, so a server that keeps handing out cursors cannot spin forever.
    for (let page = 0; page < 20; page += 1) {
      const result = await this.request<{ tools?: McpTool[]; nextCursor?: string }>(
        'tools/list',
        cursor ? { cursor } : {},
        MCP_SETUP_TIMEOUT_MS,
      );
      for (const tool of result?.tools ?? []) {
        if (tool && typeof tool.name === 'string') tools.push(tool);
      }
      cursor = result?.nextCursor;
      if (!cursor) break;
    }
    return tools;
  }

  async callTool(name: string, args: Record<string, unknown>) {
    return this.request<McpCallResult>(
      'tools/call',
      { name, arguments: args },
      MCP_CALL_TIMEOUT_MS,
    );
  }

  /** End the session if the server gave one. Best effort: the tab may be closing. */
  async close(): Promise<void> {
    if (!this.sessionId) return;
    const headers = this.headers();
    this.sessionId = null;
    await this.fetchFn(this.url, { method: 'DELETE', headers }).catch(() => {});
  }
}

export interface McpCallResult {
  content?: Array<{ type: string; text?: string; mimeType?: string; resource?: { uri?: string } }>;
  structuredContent?: unknown;
  isError?: boolean;
}

/**
 * What the agent gets back from a call: the text parts joined, other parts
 * named, so the model can say what it got instead of reading base64.
 */
export function flattenCallResult(result: McpCallResult | undefined): {
  ok: boolean;
  text: string;
} {
  const parts = (result?.content ?? []).map((part) => {
    if (part.type === 'text' && typeof part.text === 'string') return part.text;
    if (part.type === 'resource') return `[resource ${part.resource?.uri ?? ''}]`.trim();
    return `[${part.type}${part.mimeType ? ` ${part.mimeType}` : ''}]`;
  });
  let text = parts.join('\n\n');
  if (!text && result?.structuredContent !== undefined) {
    text = JSON.stringify(result.structuredContent);
  }
  return { ok: !result?.isError, text };
}

const ALLOWED_SCHEMA_KEYS = new Set([
  'type',
  'description',
  'enum',
  'items',
  'properties',
  'required',
]);

/**
 * Reduce an MCP input schema to the JSON Schema subset every provider takes.
 *
 * Servers publish whatever their framework emits -- `$schema`, `$ref`,
 * `anyOf`, `format`, `default`, `additionalProperties` -- and a provider that
 * rejects one keyword rejects the whole request, every turn. What survives is
 * type, description, enum, items, properties and required, recursively; a
 * property whose type cannot be stated becomes a described string.
 */
export function sanitizeInputSchema(schema: unknown, depth = 0): Record<string, unknown> {
  const source = schema && typeof schema === 'object' ? (schema as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!ALLOWED_SCHEMA_KEYS.has(key)) continue;
    if (key === 'properties' && value && typeof value === 'object') {
      const props: Record<string, unknown> = {};
      for (const [name, sub] of Object.entries(value as Record<string, unknown>)) {
        props[name] = depth < 6 ? sanitizeInputSchema(sub, depth + 1) : { type: 'string' };
      }
      out.properties = props;
    } else if (key === 'items') {
      out.items = depth < 6 ? sanitizeInputSchema(value, depth + 1) : { type: 'string' };
    } else if (key === 'type') {
      // ["string", "null"] -> "string": not every provider takes a type list.
      const type = Array.isArray(value) ? value.find((t) => t !== 'null') : value;
      if (typeof type === 'string') out.type = type;
    } else if (key === 'required') {
      if (Array.isArray(value)) out.required = value.filter((v) => typeof v === 'string');
    } else if (key === 'enum') {
      if (Array.isArray(value)) out.enum = value.filter((v) => typeof v === 'string');
    } else if (typeof value === 'string') {
      out[key] = value;
    }
  }
  if (!out.type) out.type = out.properties ? 'object' : 'string';
  if (out.type === 'array' && !out.items) out.items = { type: 'string' };
  if (out.type === 'object' && !out.properties) out.properties = {};
  if (Array.isArray(out.required) && out.properties) {
    const names = Object.keys(out.properties as object);
    out.required = (out.required as string[]).filter((name) => names.includes(name));
  }
  if (Array.isArray(out.enum) && !(out.enum as unknown[]).length) delete out.enum;
  return out;
}

/** `GitHub Tools` + `create-issue` -> `github_tools__create_issue`, at most 64 characters. */
export function exposedToolName(server: string, tool: string): string {
  const clean = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
  let name = `${clean(server) || 'mcp'}__${clean(tool) || 'tool'}`;
  if (!/^[a-z]/.test(name)) name = `m_${name}`;
  return name.slice(0, 64);
}
