/**
 * The only way past the send dialog. Each case is a way of getting a message out
 * that the user did not order.
 */
import { describe, expect, it } from 'vitest';
import { EXPRESS_ORDER_WINDOW_MS, isExpressOrder } from '@/lib/expressOrder';

const NOW = 1_000_000;
const turn = (content: string, timestamp = NOW - 1000) => ({ content, timestamp });

describe('isExpressOrder', () => {
  it.each([
    ['Mándaselo a Marta sin revisar', 'mandaselo a marta sin revisar'],
    ['Envíalo ya, sin confirmación', 'sin confirmación'],
    ['Respóndele que sí y no me preguntes', 'no me preguntes'],
    ['Hazlo sin mi visto bueno', 'sin mi visto bueno'],
    ['Send it without asking', 'without asking'],
    ["Send it, don't confirm", "don't confirm"],
  ])('accepts %s', (said, quoted) => {
    expect(isExpressOrder(quoted, turn(said), NOW, null)).toBe(true);
  });

  it('refuses words the user did not say, as an email or a web page might ask', () => {
    expect(isExpressOrder('sin revisar', turn('Léeme el último correo'), NOW, null)).toBe(false);
  });

  it('refuses a plain request to send', () => {
    expect(isExpressOrder('envíaselo', turn('Envíaselo a Marta'), NOW, null)).toBe(false);
  });

  it('refuses the opposite order, which contains the same phrase', () => {
    const said = 'No lo envíes sin revisar';
    expect(isExpressOrder(said, turn(said), NOW, null)).toBe(false);
    const english = 'Do not send it without review';
    expect(isExpressOrder(english, turn(english), NOW, null)).toBe(false);
  });

  it('refuses an old order', () => {
    const old = turn('sin revisar', NOW - EXPRESS_ORDER_WINDOW_MS - 1);
    expect(isExpressOrder('sin revisar', old, NOW, null)).toBe(false);
  });

  it('spends an order on one message', () => {
    const said = turn('sin revisar');
    expect(isExpressOrder('sin revisar', said, NOW, said.timestamp)).toBe(false);
  });

  it.each([[undefined], [true], [''], ['   ']])('refuses %s as a quote', (quoted) => {
    expect(isExpressOrder(quoted, turn('sin revisar'), NOW, null)).toBe(false);
  });

  it('refuses when the user has said nothing', () => {
    expect(isExpressOrder('sin revisar', undefined, NOW, null)).toBe(false);
  });
});
