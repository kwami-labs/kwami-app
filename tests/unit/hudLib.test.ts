/**
 * The HUD's pure parts: the Markdown that documents are stored in (and that must never
 * carry markup the user did not see), what an address points at, how a tool call and a
 * task's log line are drawn, and where a new window goes.
 */
import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  htmlToMarkdown,
  renderInline,
  renderMarkdown,
  reportOf,
  titleOf,
  wordCount,
} from '@/lib/hud/markdown';
import {
  classifyUrl,
  formatClock,
  hostOf,
  isSignInAddress,
  safeHttpUrl,
  youtubeEmbedUrl,
  youtubeId,
  youtubeStart,
} from '@/lib/hud/media';
import { lookOf, lookOfActivity, missionClock, tidyToolName } from '@/lib/hud/actions';
import { clampRect, maximizedRect, placeRect, MIN_WIDTH, TOP_GUTTER } from '@/lib/hud/layout';

describe('markdown out', () => {
  it('renders the shapes a report uses', () => {
    const html = renderMarkdown(
      [
        '# Informe',
        '',
        'Texto con **negrita**, *cursiva*, ~~tachado~~ y `código`.',
        'Segunda línea.',
        '',
        '## Lista',
        '- uno',
        '  - dos',
        '- tres',
        '',
        '1. primero',
        '2. segundo',
        '',
        '> una cita',
        '',
        '---',
        '',
        '| A | B |',
        '| --- | --- |',
        '| 1 | 2 |',
        '',
        '```ts',
        'const x = "<b>";',
        '```',
      ].join('\n'),
    );
    expect(html).toContain('<h1>Informe</h1>');
    expect(html).toContain('<strong>negrita</strong>');
    expect(html).toContain('<em>cursiva</em>');
    expect(html).toContain('<del>tachado</del>');
    expect(html).toContain('<code>código</code>');
    expect(html).toContain('Texto con');
    expect(html).toContain('<br>Segunda línea.');
    expect(html).toMatch(/<ul><li>uno<ul><li>dos<\/li><\/ul><\/li><li>tres<\/li><\/ul>/);
    expect(html).toContain('<ol><li>primero</li><li>segundo</li></ol>');
    expect(html).toContain('<blockquote><p>una cita</p></blockquote>');
    expect(html).toContain('<hr>');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td>2</td>');
    expect(html).toContain(
      '<pre data-lang="ts"><code>const x = &quot;&lt;b&gt;&quot;;</code></pre>',
    );
  });

  it('never lets markup through', () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('links only to web and mail addresses', () => {
    expect(renderInline('[ok](https://a.b/c)')).toBe('<a href="https://a.b/c">ok</a>');
    expect(renderInline('[mail](mailto:x@y.z)')).toContain('href="mailto:x@y.z"');
    expect(renderInline('[bad](javascript:alert(1))')).not.toContain('href');
    expect(renderInline('ver https://github.com/x.')).toBe(
      'ver <a href="https://github.com/x">https://github.com/x</a>.',
    );
    expect(renderInline('`**no**`')).toBe('<code>**no**</code>');
  });

  it('escapes what HTML would read', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('counts words and finds a title', () => {
    expect(wordCount('# Hola mundo\n\n- uno, dos')).toBe(4);
    expect(wordCount('')).toBe(0);
    expect(titleOf('texto\n## Resumen\nmás', 'x')).toBe('Resumen');
    expect(titleOf('**Primera** línea\nsegunda', 'x')).toBe('Primera línea');
    expect(titleOf('   ', 'Sin título')).toBe('Sin título');
  });
});

describe('a task result as a document', () => {
  it('keeps the report and drops what was said, when the report has its title', () => {
    expect(reportOf('Aquí lo tiene.\n\nDetalle:\n\n# Informe\n\nTexto')).toBe('# Informe\n\nTexto');
  });

  it('keeps what was said as a quote when the report has no title', () => {
    expect(reportOf('Dos frases.\nOtra.\n\n**Detalle:**\ncuerpo')).toBe(
      '> Dos frases.\n> Otra.\n\ncuerpo',
    );
  });

  it('leaves a result without a report as it is', () => {
    expect(reportOf('  solo esto  ')).toBe('solo esto');
    expect(reportOf('Dicho.\nDetalle:')).toBe('Dicho.\nDetalle:');
    expect(reportOf('Detalle:\n# Solo informe')).toBe('# Solo informe');
  });
});

describe('markdown back from the editor', () => {
  it('turns what the editor holds back into the same Markdown', () => {
    const source = [
      '# Título',
      '',
      'Un **párrafo** con *énfasis*, ~~fuera~~, `x` y [enlace](https://a.b).',
      '',
      '- uno',
      '  - dos',
      '',
      '1. a',
      '2. b',
      '',
      '> cita',
      '',
      '---',
      '',
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '```js',
      'let y = 1;',
      '```',
    ].join('\n');
    expect(htmlToMarkdown(renderMarkdown(source))).toBe(source);
  });

  it('drops what cannot be shown safely', () => {
    const md = htmlToMarkdown(
      '<p>hola <a href="javascript:alert(1)">aquí</a> <img src="javascript:x"><img src="https://a.b/i.png" alt="foto"></p><script>alert(1)</script><div><b>dentro</b><br>abajo</div><span>suelto</span>',
    );
    expect(md).not.toContain('javascript');
    expect(md).toContain('hola aquí');
    expect(md).toContain('![foto](https://a.b/i.png)');
    expect(md).toContain('**dentro**\nabajo');
    expect(md).toContain('suelto');
  });

  it('accepts an element as well as a string, and an empty table', () => {
    const el = document.createElement('div');
    el.innerHTML = '<h2>Dos</h2><table></table><a href="https://a.b">https://a.b</a>';
    expect(htmlToMarkdown(el)).toBe('## Dos\n\nhttps://a.b');
  });
});

describe('what an address is', () => {
  it('keeps only web addresses', () => {
    expect(safeHttpUrl('github.com')).toBe('https://github.com/');
    expect(safeHttpUrl('http://a.b/x?y=1')).toBe('http://a.b/x?y=1');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('ftp://a.b')).toBeNull();
    expect(safeHttpUrl('  ')).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl('https://exa mple.com')).toBeNull();
  });

  it('finds YouTube in every shape, and its start', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42',
      'https://youtu.be/dQw4w9WgXcQ?t=1m2s',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://m.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/live/dQw4w9WgXcQ',
    ]) {
      expect(youtubeId(url), url).toBe('dQw4w9WgXcQ');
    }
    expect(youtubeId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(youtubeId('https://www.youtube.com/feed')).toBeNull();
    expect(youtubeId('not a url')).toBeNull();
    expect(youtubeStart('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe(42);
    expect(youtubeStart('https://youtu.be/dQw4w9WgXcQ?t=1h2m3s')).toBe(3723);
    expect(youtubeStart('https://youtu.be/dQw4w9WgXcQ?start=90s')).toBe(90);
    expect(youtubeStart('https://youtu.be/dQw4w9WgXcQ?t=oops')).toBe(0);
    expect(youtubeStart('https://youtu.be/dQw4w9WgXcQ')).toBe(0);
    expect(youtubeStart('nope')).toBe(0);
  });

  it('sorts addresses by what they show', () => {
    expect(classifyUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    expect(classifyUrl('https://a.b/v.mp4?x=1')).toBe('video');
    expect(classifyUrl('https://a.b/s.mp3')).toBe('audio');
    expect(classifyUrl('https://a.b/i.webp')).toBe('image');
    expect(classifyUrl('https://a.b/doc.pdf')).toBe('pdf');
    expect(classifyUrl('https://a.b/page')).toBe('web');
    expect(classifyUrl('relative/clip.webm')).toBe('video');
  });

  it('builds the embed the player drives', () => {
    const url = youtubeEmbedUrl('dQw4w9WgXcQ', {
      start: 12.7,
      end: 30.2,
      autoplay: true,
      loop: true,
    });
    expect(url).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?');
    expect(url).toContain('enablejsapi=1');
    expect(url).toContain('start=12');
    expect(url).toContain('end=31');
    expect(url).toContain('autoplay=1');
    expect(url).toContain('playlist=dQw4w9WgXcQ');
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).not.toContain('start=');
  });

  it('knows a sign-in when it sees one', () => {
    expect(isSignInAddress('https://accounts.google.com/o/oauth2/v2/auth?x=1')).toBe(true);
    expect(isSignInAddress('https://github.com/login')).toBe(true);
    expect(isSignInAddress('https://api.kwami.io/google/connect/start')).toBe(true);
    expect(isSignInAddress('https://github.com/kwami-labs')).toBe(false);
    expect(isSignInAddress('nope')).toBe(false);
  });

  it('names hosts and clocks', () => {
    expect(hostOf('https://www.github.com/x')).toBe('github.com');
    expect(hostOf('nope')).toBe('');
    expect(formatClock(75.4)).toBe('1:15');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(Number.NaN)).toBe('0:00');
  });
});

describe('how actions are drawn', () => {
  it('gives known tools their own words and the rest a family', () => {
    expect(lookOf('navigate_to')).toMatchObject({ family: 'web', labelKey: 'navigate_to' });
    expect(lookOf('click_in_navigation').icon).toBe('ph:cursor-click-duotone');
    expect(lookOf('send_gmail_message')).toMatchObject({ family: 'comms', labelKey: null });
    expect(lookOf('set_theme_control').family).toBe('ui');
    expect(lookOf('something_new').family).toBe('system');
  });

  it('tidies a tool name', () => {
    expect(tidyToolName('navigate_to')).toBe('Navigate to');
    expect(tidyToolName('mcp__browser__open')).toBe('Open');
    expect(tidyToolName('__')).toBe('__');
  });

  it('reads the lines a task logs', () => {
    expect(lookOfActivity('Bash: npm test')).toMatchObject({ kind: 'shell', detail: 'npm test' });
    expect(lookOfActivity('model: Opus')).toMatchObject({ kind: 'model', detail: 'Opus' });
    expect(lookOfActivity('step_done: buscar')).toMatchObject({ kind: 'stepDone' });
    expect(lookOfActivity('mcp__browser__open: https://a.b').kind).toBe('browser');
    expect(lookOfActivity('mcp__browser__sign_in: a.b').kind).toBe('signIn');
    expect(lookOfActivity('mcp__google__call: list').kind).toBe('google');
    expect(lookOfActivity('mcp__kwami_db__call').kind).toBe('database');
    expect(lookOfActivity('reviewer: Comprueba el informe')).toMatchObject({
      kind: 'team',
      tool: 'reviewer',
    });
    expect(lookOfActivity('TodoWrite')).toMatchObject({ kind: 'other', detail: '' });
  });

  it('keeps a mission clock', () => {
    expect(missionClock('2026-11-16T08:01:24Z', '2026-11-16T08:00:00Z')).toBe('+01:24');
    expect(missionClock('2026-11-16T07:00:00Z', '2026-11-16T08:00:00Z')).toBe('+00:00');
    expect(missionClock('x', 'y')).toBe('+00:00');
  });
});

describe('where windows go', () => {
  const view = { width: 1600, height: 900 };

  it('stacks tasks on the left, the browser on the right, the rest in the middle', () => {
    const task = placeRect('task', [], view);
    const second = placeRect('task', [{ kind: 'task', minimized: false }], view);
    expect(task.x).toBeLessThan(100);
    expect(second.y).toBeGreaterThan(task.y);
    expect(placeRect('browser', [], view).x).toBeGreaterThan(view.width / 2);
    const doc = placeRect('document', [], view);
    const next = placeRect('document', [{ kind: 'document', minimized: false }], view);
    expect(doc.x).toBeGreaterThan(300);
    expect(next.x).toBeGreaterThan(doc.x);
  });

  it('keeps clear of the band the sidebar panel covers', () => {
    const covered = { width: 1600, height: 900, left: 540 };
    expect(placeRect('task', [], covered).x).toBeGreaterThanOrEqual(540 + 16);
    expect(placeRect('document', [], covered).x).toBeGreaterThanOrEqual(540);
    expect(maximizedRect(covered)).toMatchObject({ x: 556, w: 1600 - 540 - 32 });
    const right = { width: 1600, height: 900, right: 500 };
    const browser = placeRect('browser', [], right);
    expect(browser.x + browser.w).toBeLessThanOrEqual(1600 - 500);
    expect(clampRect({ x: 1500, y: 100, w: 400, h: 300 }, right).x).toBe(1600 - 500 - 400 - 16);
  });

  it('keeps every window on screen, however small the screen', () => {
    const small = { width: 360, height: 640 };
    const rect = placeRect('web', [], small);
    expect(rect.x + rect.w).toBeLessThanOrEqual(small.width);
    expect(rect.y).toBeGreaterThanOrEqual(TOP_GUTTER);
    expect(clampRect({ x: -50, y: -50, w: 10, h: 10 }, view)).toMatchObject({ w: MIN_WIDTH });
    const max = maximizedRect(view);
    expect(max.w).toBe(view.width - 32);
  });
});
