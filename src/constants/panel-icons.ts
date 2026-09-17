/**
 * Centralized panel icon definitions.
 * All panel and sidebar icons should reference this map.
 */
export const panelIcons = {
  avatar: 'ph:ghost-duotone',
  scene: 'ph:mountains-duotone',
  audio: 'ph:waveform-duotone',
  voice: 'mdi:account-voice',
  enhancements: 'ph:sliders-duotone',
  soul: 'ph:heart-duotone',
  memory: 'ph:brain-duotone',
  tools: 'ph:wrench-duotone',
  metrics: 'ph:chart-line-up-duotone',
  transcription: 'ph:chat-circle-text-duotone',
  history: 'ph:clock-counter-clockwise-duotone',
  communications: 'ph:phone-call-duotone',
  phone: 'ph:phone-duotone',
  whatsapp: 'mdi:whatsapp',
  sms: 'ph:chat-text-duotone',
  info: 'ph:info-duotone',
  account: 'ph:user-duotone',
  theme: 'ph:palette-duotone',
  models: 'ph:cpu-duotone',
  credits: 'ph:lightning-duotone',
  contacts: 'ph:address-book-duotone',
  email: 'ph:envelope-duotone',
  wallet: 'ph:wallet-duotone',
  calendar: 'ph:calendar-duotone',
} as const satisfies Record<string, string>;

export type PanelIconKey = keyof typeof panelIcons;

/**
 * Icon lookup for a panel id that is only known at runtime (nav loops).
 * Falls back to a neutral glyph rather than rendering an empty icon slot.
 */
export function panelIcon(id: string): string {
  return (panelIcons as Record<string, string>)[id] ?? 'ph:circle-duotone';
}
