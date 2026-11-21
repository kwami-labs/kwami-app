/**
 * A message to the agent on the data channel, the way the rest of the app sends one:
 * the SDK's LiveKit adapter listens for `kwami:send_data` with the encoded bytes.
 * Nothing happens when no call is connected, which is the honest outcome for a button
 * pressed with no Jarvis listening.
 */
export function sendToAgent(payload: Record<string, unknown>): void {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent('kwami:send_data', { detail: bytes }));
}
