/**
 * Reading a tool's parameter schema as rows a person can scan.
 *
 * Tools arrive in two shapes: a full JSON Schema object
 * (`{ type: 'object', properties, required }`) or the SDK's shorthand, a bare
 * map of property name to schema, which `ToolRegistry.getToolDefinitions()`
 * wraps with `required: []` before it reaches the model. Both read the same.
 */

export interface ToolParam {
  name: string;
  /** `string`, `number`, `array<string>`, `string | number`, or `any` when untyped. */
  type: string;
  required: boolean;
  description?: string;
  /** Allowed values, when the schema restricts them. */
  enum?: string[];
}

type Schema = Record<string, unknown>;

function isRecord(value: unknown): value is Schema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function typeOf(schema: Schema): string {
  const raw = schema.type;
  const base = Array.isArray(raw) ? raw.filter((t) => typeof t === 'string').join(' | ') : raw;
  if (base === 'array' && isRecord(schema.items) && typeof schema.items.type === 'string') {
    return `array<${schema.items.type}>`;
  }
  if (typeof base === 'string' && base) return base;
  if (Array.isArray(schema.enum)) return 'enum';
  return 'any';
}

/** The `properties` map and `required` list of either shape. */
export function schemaProperties(parameters: unknown): {
  properties: Record<string, Schema>;
  required: string[];
} {
  if (!isRecord(parameters)) return { properties: {}, required: [] };
  const full = parameters.type === 'object' && isRecord(parameters.properties);
  const props = (full ? parameters.properties : parameters) as Record<string, unknown>;
  const properties: Record<string, Schema> = {};
  for (const [name, schema] of Object.entries(props)) {
    properties[name] = isRecord(schema) ? schema : {};
  }
  const required =
    full && Array.isArray(parameters.required)
      ? parameters.required.filter((r): r is string => typeof r === 'string')
      : [];
  return { properties, required };
}

export function describeParameters(parameters: unknown): ToolParam[] {
  const { properties, required } = schemaProperties(parameters);
  return Object.entries(properties).map(([name, schema]) => {
    const param: ToolParam = { name, type: typeOf(schema), required: required.includes(name) };
    if (typeof schema.description === 'string' && schema.description) {
      param.description = schema.description;
    }
    if (Array.isArray(schema.enum)) param.enum = schema.enum.map((v) => String(v));
    return param;
  });
}

/**
 * The first sentence of a description, for a one-line summary.
 *
 * App tool descriptions are written for the model and run to several hundred
 * characters; a list needs the gist, with the rest a click away.
 */
export function summarize(description: string, max = 140): string {
  const text = description.replace(/\s+/g, ' ').trim();
  const sentence = /^(.+?[.!?])(\s|$)/.exec(text)?.[1] ?? text;
  return sentence.length <= max ? sentence : `${sentence.slice(0, max - 1).trimEnd()}…`;
}

/** Lower-case, accents stripped: "búsqueda" matches "busqueda" and back. */
export function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
