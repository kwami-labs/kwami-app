import type { ToolGroupId } from '@/lib/toolRegistration';

/** How each tool group looks in the Tools panel: an icon and a hue for its chip. */
export const TOOL_GROUP_LOOK: Record<ToolGroupId, { icon: string; color: string }> = {
  interface: { icon: 'ph:squares-four-duotone', color: '#00d9ff' },
  appearance: { icon: 'ph:palette-duotone', color: '#f472b6' },
  personality: { icon: 'ph:user-sound-duotone', color: '#a855f7' },
  search: { icon: 'ph:magnifying-glass-duotone', color: '#38bdf8' },
  memory: { icon: 'ph:brain-duotone', color: '#818cf8' },
  assistant: { icon: 'ph:bell-ringing-duotone', color: '#fbbf24' },
  communications: { icon: 'ph:phone-call-duotone', color: '#34d399' },
  email: { icon: 'ph:envelope-simple-duotone', color: '#60a5fa' },
  calendar: { icon: 'ph:calendar-dots-duotone', color: '#fb923c' },
  google: { icon: 'ph:google-logo-duotone', color: '#4ade80' },
  companions: { icon: 'ph:users-three-duotone', color: '#e879f9' },
  extras: { icon: 'ph:sparkle-duotone', color: '#facc15' },
  custom: { icon: 'ph:webhooks-logo-duotone', color: '#22d3ee' },
  mcp: { icon: 'ph:plugs-connected-duotone', color: '#2dd4bf' },
  other: { icon: 'ph:puzzle-piece-duotone', color: '#94a3b8' },
};
