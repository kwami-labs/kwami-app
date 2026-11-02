/**
 * Whether the user really ordered a message sent without the app's dialog.
 *
 * The user's rule (2026-11-01): with their approval, or without it if they order
 * it. The model cannot be the judge of that, or the gate is the model and an email
 * saying "send this without asking" is one step from going out. So the model only
 * quotes, and this checks the quote against the user's own latest words: anything
 * they did not say does not count, whatever a web page or a message may have said.
 *
 * Pure, so every way of getting past it can be tested.
 */

/** Long enough to cover the read-back the charter asks for, short enough to be this request. */
export const EXPRESS_ORDER_WINDOW_MS = 120_000;

const WITHOUT_REVIEW = [
  /\bsin (revisar|revision|confirmar|confirmacion|preguntar|preguntarme|dialogo)\b/,
  /\bsin (mi |el )?visto bueno\b/,
  /\bsin que lo (vea|revise)\b/,
  /\bno (me )?(preguntes|pregunte|confirmes|confirme)\b/,
  /\b(without|no) (review|reviewing|confirmation|confirming|asking)\b/,
  /\bdon t (ask|confirm)\b/,
];

/** "Do not send it without review" contains the phrase and means the opposite. */
const FORBIDS_SENDING = [
  /\bno (lo |la |los |las |le |les )?(envies|envie|mandes|mande|envia|mandar|enviar)\b/,
  /\b(don t|do not|never) send\b/,
];

export interface SpokenTurn {
  content: string;
  timestamp: number;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** `usedTimestamp` is the turn already spent: one order covers one message. */
export function isExpressOrder(
  order: unknown,
  lastUserTurn: SpokenTurn | undefined,
  now: number,
  usedTimestamp: number | null,
): boolean {
  if (typeof order !== 'string' || !lastUserTurn) return false;
  if (lastUserTurn.timestamp === usedTimestamp) return false;
  if (now - lastUserTurn.timestamp > EXPRESS_ORDER_WINDOW_MS) return false;
  const quoted = normalize(order);
  if (!quoted || !normalize(lastUserTurn.content).includes(quoted)) return false;
  if (FORBIDS_SENDING.some((pattern) => pattern.test(quoted))) return false;
  return WITHOUT_REVIEW.some((pattern) => pattern.test(quoted));
}
