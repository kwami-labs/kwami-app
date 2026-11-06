/**
 * Webhook tools a user adds from the Tools panel.
 *
 * Everything here exists because a bad definition does not fail where it is
 * made. The agent passes client tools straight to the model provider, and the
 * provider rejects the *whole request* -- every turn, for the rest of the
 * session -- when one tool is malformed: a name with a space or an accent, or
 * parameters written as `{"city": "string"}`, which the SDK wraps into a schema
 * whose property is a string rather than an object. So a tool is checked here
 * before it is ever registered, and the schema is built rather than typed.
 */

export const PARAM_TYPES = ['string', 'number', 'integer', 'boolean'] as const;
export type ParamType = (typeof PARAM_TYPES)[number];

export interface UserToolParam {
  name: string;
  type: ParamType;
  required: boolean;
  description?: string;
  /** Allowed values; only for `string`. */
  enum?: string[];
}

export type WebhookMethod = 'GET' | 'POST';

export interface UserWebhookTool {
  name: string;
  description: string;
  url: string;
  method: WebhookMethod;
  params: UserToolParam[];
}

/**
 * What every provider the agent can switch to accepts as a function name.
 *
 * OpenAI allows `[a-zA-Z0-9_-]{1,64}`, Gemini wants a letter or underscore
 * first and no more than 64; a letter first and `[a-zA-Z0-9_]` after is inside
 * both, and matches how the app's own tools are named.
 */
export const TOOL_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

/** Same rule for parameter names, which become JSON Schema property keys. */
export const PARAM_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

/** A user tool call should not hold the agent's turn hostage. */
export const WEBHOOK_TIMEOUT_MS = 15_000;

export type ToolIssueCode =
  | 'nameRequired'
  | 'nameInvalid'
  | 'nameTaken'
  | 'descriptionRequired'
  | 'urlInvalid'
  | 'urlInsecure'
  | 'paramNameInvalid'
  | 'paramDuplicate'
  | 'placeholderUnknown'
  | 'enumEmpty';

export interface ToolIssue {
  field: 'name' | 'description' | 'url' | 'params';
  code: ToolIssueCode;
  /** The parameter or placeholder concerned, when there is one. */
  subject?: string;
}

/** `{name}` placeholders in a URL template, in order, without repeats. */
export function urlPlaceholders(url: string): string[] {
  return [...new Set([...url.matchAll(/\{([^{}/?#&=]+)\}/g)].map((m) => m[1]))];
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  );
}

/**
 * Everything wrong with a tool, or nothing.
 *
 * `takenNames` are the tools already registered that this one must not
 * replace: the app's own, and other user tools. Editing a tool passes its old
 * name as `editing` so it does not collide with itself.
 */
export function validateUserTool(
  tool: UserWebhookTool,
  takenNames: ReadonlySet<string>,
  editing?: string,
): ToolIssue[] {
  const issues: ToolIssue[] = [];
  const name = tool.name.trim();

  if (!name) issues.push({ field: 'name', code: 'nameRequired' });
  else if (!TOOL_NAME_PATTERN.test(name)) issues.push({ field: 'name', code: 'nameInvalid' });
  else if (name !== editing && takenNames.has(name)) {
    issues.push({ field: 'name', code: 'nameTaken' });
  }

  if (!tool.description.trim()) issues.push({ field: 'description', code: 'descriptionRequired' });

  // Placeholders are swapped out before parsing: `{title}` is not a valid host.
  const sample = tool.url.trim().replace(/\{[^{}]*\}/g, 'x');
  let parsed: URL | null = null;
  try {
    parsed = new URL(sample);
  } catch {
    parsed = null;
  }
  if (!parsed || !/^https?:$/.test(parsed.protocol)) {
    issues.push({ field: 'url', code: 'urlInvalid' });
  } else if (parsed.protocol === 'http:' && !isLocalHost(parsed.hostname)) {
    // The arguments the model fills in -- names, addresses, whatever the user
    // said -- would cross the network in clear.
    issues.push({ field: 'url', code: 'urlInsecure' });
  }

  const seen = new Set<string>();
  for (const param of tool.params) {
    const pname = param.name.trim();
    if (!PARAM_NAME_PATTERN.test(pname)) {
      issues.push({ field: 'params', code: 'paramNameInvalid', subject: pname });
    } else if (seen.has(pname)) {
      issues.push({ field: 'params', code: 'paramDuplicate', subject: pname });
    }
    seen.add(pname);
    if (param.enum && param.enum.length === 0) {
      issues.push({ field: 'params', code: 'enumEmpty', subject: pname });
    }
  }
  for (const placeholder of urlPlaceholders(tool.url)) {
    if (!seen.has(placeholder)) {
      issues.push({ field: 'url', code: 'placeholderUnknown', subject: placeholder });
    }
  }

  return issues;
}

/**
 * The JSON Schema the model sees for a tool's parameters.
 *
 * A parameter named in the URL is always required: without it the request
 * goes to a path with a hole in it.
 */
export function toParametersSchema(tool: Pick<UserWebhookTool, 'params' | 'url'>) {
  const inPath = new Set(urlPlaceholders(tool.url));
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];
  for (const param of tool.params) {
    const schema: Record<string, unknown> = { type: param.type };
    if (param.description?.trim()) schema.description = param.description.trim();
    if (param.type === 'string' && param.enum?.length) schema.enum = [...param.enum];
    properties[param.name] = schema;
    if (param.required || inPath.has(param.name)) required.push(param.name);
  }
  return { type: 'object', properties, required, additionalProperties: false };
}

/** Turn the model's arguments into the request: path first, then query or body. */
export function buildRequest(
  tool: Pick<UserWebhookTool, 'url' | 'method'>,
  args: Record<string, unknown>,
): { url: string; init: RequestInit } {
  const rest: Record<string, unknown> = { ...args };
  let url = tool.url.trim().replace(/\{([^{}/?#&=]+)\}/g, (_, key: string) => {
    const value = rest[key];
    delete rest[key];
    return encodeURIComponent(value == null ? '' : String(value));
  });

  if (tool.method === 'GET') {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined || value === null) continue;
      query.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    const qs = query.toString();
    if (qs) url += `${url.includes('?') ? '&' : '?'}${qs}`;
    return { url, init: { method: 'GET' } };
  }

  return {
    url,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rest),
    },
  };
}

/**
 * The handler the agent's call ends up in.
 *
 * A plain `fetch`, not the app's API client: the target is the user's own
 * third-party URL, and it must never receive the user's Kwami bearer token.
 * Never throws -- the result goes back to the model, which can tell the user
 * what went wrong only if it is told.
 */
export function createWebhookHandler(tool: Pick<UserWebhookTool, 'url' | 'method'>) {
  return async (args: Record<string, unknown>) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const request = buildRequest(tool, args);
      const res = await fetch(request.url, { ...request.init, signal: controller.signal });
      const text = await res.text();
      let data: unknown = text;
      try {
        data = JSON.parse(text);
      } catch {
        // Not JSON; hand the agent the raw body.
      }
      return { ok: res.ok, status: res.status, data };
    } catch (e: unknown) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      return {
        ok: false,
        error: aborted
          ? `The webhook did not answer within ${WEBHOOK_TIMEOUT_MS / 1000} s`
          : // A TypeError from fetch is almost always CORS or an unreachable host;
            // the browser does not say which.
            `The webhook could not be reached (${e instanceof Error ? e.message : String(e)}). ` +
            'It may be down, or it may not accept requests from this app (CORS).',
      };
    } finally {
      clearTimeout(timer);
    }
  };
}

function asParam(raw: unknown): UserToolParam | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.name !== 'string' || !PARAM_NAME_PATTERN.test(p.name)) return null;
  const type = PARAM_TYPES.includes(p.type as ParamType) ? (p.type as ParamType) : 'string';
  const param: UserToolParam = { name: p.name, type, required: p.required === true };
  if (typeof p.description === 'string' && p.description) param.description = p.description;
  if (Array.isArray(p.enum)) {
    const values = p.enum.filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (values.length) param.enum = values;
  }
  return param;
}

/**
 * Read saved tools back, dropping anything that would not validate.
 *
 * The snapshot comes from the account row, which outlives any one version of
 * this file; one bad entry must cost that entry, not the session.
 */
export function parseUserTools(raw: unknown): UserWebhookTool[] {
  if (!Array.isArray(raw)) return [];
  const tools: UserWebhookTool[] = [];
  const names = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.name !== 'string' || typeof e.url !== 'string') continue;
    const tool: UserWebhookTool = {
      name: e.name,
      description: typeof e.description === 'string' ? e.description : '',
      url: e.url,
      method: e.method === 'GET' ? 'GET' : 'POST',
      params: Array.isArray(e.params)
        ? e.params.map(asParam).filter((p): p is UserToolParam => p !== null)
        : [],
    };
    if (validateUserTool(tool, names).length) continue;
    names.add(tool.name);
    tools.push(tool);
  }
  return tools;
}

export function emptyUserTool(): UserWebhookTool {
  return { name: '', description: '', url: '', method: 'GET', params: [] };
}
