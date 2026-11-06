import { describe, expect, it } from 'vitest';
import { describeParameters, foldForSearch, summarize } from '@/lib/toolSchema';

describe('describeParameters', () => {
  it('reads the SDK shorthand: a bare map of property schemas', () => {
    expect(
      describeParameters({
        control: { type: 'string', enum: ['layout', 'expand'] },
        value: {},
        position: { type: 'number', description: 'From 1' },
      }),
    ).toEqual([
      { name: 'control', type: 'string', required: false, enum: ['layout', 'expand'] },
      { name: 'value', type: 'any', required: false },
      { name: 'position', type: 'number', required: false, description: 'From 1' },
    ]);
  });

  it('reads a full JSON Schema object, required list included', () => {
    expect(
      describeParameters({
        type: 'object',
        properties: {
          to: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          when: { type: ['string', 'null'] },
        },
        required: ['to'],
      }),
    ).toEqual([
      { name: 'to', type: 'string', required: true },
      { name: 'tags', type: 'array<string>', required: false },
      { name: 'when', type: 'string | null', required: false },
    ]);
  });

  it('has no rows for a tool without parameters', () => {
    expect(describeParameters(undefined)).toEqual([]);
    expect(describeParameters({})).toEqual([]);
    expect(describeParameters({ type: 'object', properties: {} })).toEqual([]);
  });

  it('survives junk instead of throwing in the panel', () => {
    expect(describeParameters('nope')).toEqual([]);
    expect(describeParameters({ odd: 'string' })).toEqual([
      { name: 'odd', type: 'any', required: false },
    ]);
  });
});

describe('summarize', () => {
  it('keeps the first sentence', () => {
    expect(summarize('Opens a result. Counts from 1. Never searches.')).toBe('Opens a result.');
  });

  it('cuts a long first sentence with an ellipsis', () => {
    const out = summarize(`${'word '.repeat(60)}end.`, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith('…')).toBe(true);
  });

  it('collapses whitespace and takes the whole text when there is no full stop', () => {
    expect(summarize('  Lists   the\nchannels ')).toBe('Lists the channels');
  });
});

describe('foldForSearch', () => {
  it('matches with or without accents and case', () => {
    expect(foldForSearch('Búsqueda')).toBe('busqueda');
    expect(foldForSearch('CALENDARIO')).toBe('calendario');
  });
});
