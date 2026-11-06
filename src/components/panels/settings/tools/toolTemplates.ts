import type { UserWebhookTool } from '@/lib/userTools';

/**
 * Starting points for a webhook tool.
 *
 * The previous templates filled in a name and a schema and left the URL empty,
 * so none of them could run. These call free public APIs that need no key and
 * answer browsers (each checked for `Access-Control-Allow-Origin: *`), so
 * picking one and saving gives the agent a tool that works; the last is the
 * blank shape for Zapier, Make, n8n and the like.
 *
 * Descriptions are model-facing and come from the locale bundle, in the
 * user's language, like the app's own tools.
 */
export const TOOL_TEMPLATE_IDS = [
  'weather',
  'wikipedia',
  'exchange',
  'holidays',
  'automation',
] as const;
export type ToolTemplateId = (typeof TOOL_TEMPLATE_IDS)[number];

export const TOOL_TEMPLATE_ICONS: Record<ToolTemplateId, string> = {
  weather: 'ph:cloud-sun-duotone',
  wikipedia: 'ph:book-open-text-duotone',
  exchange: 'ph:currency-circle-dollar-duotone',
  holidays: 'ph:calendar-star-duotone',
  automation: 'ph:lightning-duotone',
};

type Translate = (key: string) => string;

export function buildTemplate(id: ToolTemplateId, t: Translate, locale: string): UserWebhookTool {
  const text = (key: string) => t(`toolsPanel.templates.${id}.${key}`);
  switch (id) {
    case 'weather':
      return {
        name: 'get_current_weather',
        description: text('description'),
        method: 'GET',
        url:
          'https://api.open-meteo.com/v1/forecast?current=temperature_2m,apparent_temperature,' +
          'relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto',
        params: [
          { name: 'latitude', type: 'number', required: true, description: text('latitude') },
          { name: 'longitude', type: 'number', required: true, description: text('longitude') },
        ],
      };
    case 'wikipedia':
      return {
        name: 'wikipedia_summary',
        description: text('description'),
        method: 'GET',
        url: `https://${locale === 'es' ? 'es' : 'en'}.wikipedia.org/api/rest_v1/page/summary/{title}`,
        params: [{ name: 'title', type: 'string', required: true, description: text('title') }],
      };
    case 'exchange':
      return {
        name: 'exchange_rates',
        description: text('description'),
        method: 'GET',
        url: 'https://api.frankfurter.dev/v1/latest',
        params: [
          { name: 'base', type: 'string', required: true, description: text('base') },
          { name: 'symbols', type: 'string', required: false, description: text('symbols') },
        ],
      };
    case 'holidays':
      return {
        name: 'public_holidays',
        description: text('description'),
        method: 'GET',
        url: 'https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}',
        params: [
          { name: 'year', type: 'integer', required: true, description: text('year') },
          { name: 'countryCode', type: 'string', required: true, description: text('countryCode') },
        ],
      };
    case 'automation':
      return { name: '', description: '', method: 'POST', url: '', params: [] };
  }
}
