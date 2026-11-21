/**
 * Markdown in and out of the HUD's documents.
 *
 * Reports reach the HUD as Markdown (a task's result, a note Jarvis writes) and the
 * document widget edits them as rich text. Markdown is the stored form, so what is
 * saved never carries markup the user did not see: HTML is rebuilt from it on every
 * load, and anything pasted goes through `htmlToMarkdown` first. Nothing here emits
 * an attribute other than `href`, and only for http(s) and mailto addresses.
 */

const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(raw: string): string | null {
  const href = raw.trim();
  return SAFE_HREF.test(href) ? href : null;
}

/** Inline Markdown on one line of text: code, links, bold, italic, strike, bare URLs. */
export function renderInline(source: string): string {
  // Code spans first, held aside so nothing inside them is read as Markdown.
  const held: string[] = [];
  const hold = (html: string) => `\u0000${held.push(html) - 1}\u0000`;
  let text = source.replace(/`([^`]+)`/g, (_, code: string) =>
    hold(`<code>${escapeHtml(code)}</code>`),
  );

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, href: string) => {
    const safe = safeHref(href);
    if (!safe) return whole;
    return hold(`<a href="${escapeHtml(safe)}">${renderInline(label)}</a>`);
  });
  text = text.replace(/\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g, (url) =>
    hold(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`),
  );

  text = escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^\w_])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');

  return text.replace(/\u0000(\d+)\u0000/g, (_, index: string) => held[Number(index)] ?? '');
}

interface ListItem {
  ordered: boolean;
  indent: number;
  text: string;
}

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function renderList(items: ListItem[]): string {
  let html = '';
  const stack: { ordered: boolean; indent: number }[] = [];
  for (const item of items) {
    while (stack.length && item.indent < stack[stack.length - 1].indent) {
      html += `</li></${stack.pop()!.ordered ? 'ol' : 'ul'}>`;
    }
    const top = stack[stack.length - 1];
    if (!top || item.indent > top.indent) {
      stack.push({ ordered: item.ordered, indent: item.indent });
      html += item.ordered ? '<ol><li>' : '<ul><li>';
    } else {
      html += '</li><li>';
    }
    html += renderInline(item.text);
  }
  while (stack.length) html += `</li></${stack.pop()!.ordered ? 'ol' : 'ul'}>`;
  return html;
}

function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** A whole Markdown document as HTML. Safe to assign to `innerHTML`. */
export function renderMarkdown(source: string): string {
  const lines = (source || '').replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) out.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`);
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```\s*([\w+-]*)/);
    if (fence) {
      flush();
      const body: string[] = [];
      while (++i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i]);
      const lang = fence[1] ? ` data-lang="${escapeHtml(fence[1])}"` : '';
      out.push(`<pre${lang}><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      flush();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }
    if (RULE.test(line)) {
      flush();
      out.push('<hr>');
      continue;
    }
    if (/^\s*>/.test(line)) {
      flush();
      const quoted: string[] = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]); i++) {
        quoted.push(lines[i].replace(/^\s*>\s?/, ''));
      }
      i--;
      out.push(`<blockquote>${renderMarkdown(quoted.join('\n'))}</blockquote>`);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
      flush();
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      for (; i < lines.length && lines[i].includes('|') && lines[i].trim(); i++) {
        rows.push(cells(lines[i]));
      }
      i--;
      const th = head.map((c) => `<th>${renderInline(c)}</th>`).join('');
      const body = rows
        .map(
          (row) =>
            `<tr>${head.map((_, k) => `<td>${renderInline(row[k] ?? '')}</td>`).join('')}</tr>`,
        )
        .join('');
      out.push(`<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`);
      continue;
    }
    if (LIST_ITEM.test(line)) {
      flush();
      const items: ListItem[] = [];
      for (; i < lines.length; i++) {
        const match = lines[i].match(LIST_ITEM);
        if (!match) break;
        items.push({
          ordered: /\d/.test(match[2]),
          indent: match[1].replace(/\t/g, '  ').length,
          text: match[3],
        });
      }
      i--;
      out.push(renderList(items));
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Back from the editor
// ---------------------------------------------------------------------------

function inlineOf(node: Node): string {
  let text = '';
  node.childNodes.forEach((child) => {
    text += inlineNode(child);
  });
  return text;
}

function wrap(mark: string, inner: string): string {
  const trimmed = inner.trim();
  if (!trimmed) return inner;
  const lead = inner.slice(0, inner.indexOf(trimmed[0]));
  const tail = inner.slice(inner.lastIndexOf(trimmed[trimmed.length - 1]) + 1);
  return `${lead}${mark}${trimmed}${mark}${tail}`;
}

function inlineNode(node: Node): string {
  if (node.nodeType === 3) return (node.textContent ?? '').replace(/\s+/g, ' ');
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'strong':
    case 'b':
      return wrap('**', inlineOf(el));
    case 'em':
    case 'i':
      return wrap('*', inlineOf(el));
    case 's':
    case 'del':
    case 'strike':
      return wrap('~~', inlineOf(el));
    case 'code':
      return `\`${el.textContent ?? ''}\``;
    case 'br':
      return '\n';
    case 'a': {
      const href = safeHref(el.getAttribute('href') ?? '');
      const label = inlineOf(el).trim();
      if (!href) return label;
      return label && label !== href ? `[${label}](${href})` : href;
    }
    case 'img': {
      const src = safeHref(el.getAttribute('src') ?? '');
      return src ? `![${el.getAttribute('alt') ?? ''}](${src})` : '';
    }
    default:
      return inlineOf(el);
  }
}

function listToMarkdown(list: Element, depth: number): string {
  const ordered = list.tagName.toLowerCase() === 'ol';
  const lines: string[] = [];
  let index = 1;
  for (const item of Array.from(list.children)) {
    if (item.tagName.toLowerCase() !== 'li') continue;
    const own: string[] = [];
    const nested: string[] = [];
    item.childNodes.forEach((child) => {
      const tag = child.nodeType === 1 ? (child as Element).tagName.toLowerCase() : '';
      if (tag === 'ul' || tag === 'ol') nested.push(listToMarkdown(child as Element, depth + 1));
      else own.push(child.nodeType === 1 && tag === 'p' ? inlineOf(child) : inlineNode(child));
    });
    const marker = ordered ? `${index++}.` : '-';
    lines.push(`${'  '.repeat(depth)}${marker} ${own.join('').trim()}`);
    lines.push(...nested);
  }
  return lines.join('\n');
}

function blockToMarkdown(node: Node): string {
  if (node.nodeType === 3) {
    const text = (node.textContent ?? '').trim();
    return text;
  }
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const heading = tag.match(/^h([1-6])$/);
  if (heading) return `${'#'.repeat(Number(heading[1]))} ${inlineOf(el).trim()}`;
  switch (tag) {
    case 'p':
      return inlineOf(el).trim();
    case 'div':
    case 'section':
    case 'article':
      return childrenToMarkdown(el);
    case 'ul':
    case 'ol':
      return listToMarkdown(el, 0);
    case 'blockquote':
      return childrenToMarkdown(el)
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    case 'pre': {
      const lang = el.getAttribute('data-lang') ?? '';
      return `\`\`\`${lang}\n${(el.textContent ?? '').replace(/\n$/, '')}\n\`\`\``;
    }
    case 'hr':
      return '---';
    case 'table': {
      const rows = Array.from(el.querySelectorAll('tr')).map((row) =>
        Array.from(row.children).map((cell) => inlineOf(cell).trim().replace(/\|/g, '\\|')),
      );
      if (!rows.length) return '';
      const width = Math.max(...rows.map((r) => r.length));
      const line = (r: string[]) =>
        `| ${Array.from({ length: width }, (_, k) => r[k] ?? '').join(' | ')} |`;
      return [line(rows[0]), `|${' --- |'.repeat(width)}`, ...rows.slice(1).map(line)].join('\n');
    }
    default:
      return inlineOf(el).trim();
  }
}

function childrenToMarkdown(el: Element): string {
  const blocks: string[] = [];
  let inline = '';
  const pushInline = () => {
    if (inline.trim()) blocks.push(inline.trim());
    inline = '';
  };
  el.childNodes.forEach((child) => {
    const tag = child.nodeType === 1 ? (child as Element).tagName.toLowerCase() : '';
    const isInline =
      child.nodeType === 3 ||
      ['strong', 'b', 'em', 'i', 's', 'del', 'strike', 'code', 'a', 'span', 'br', 'img'].includes(
        tag,
      );
    if (isInline) {
      inline += inlineNode(child);
      return;
    }
    pushInline();
    const md = blockToMarkdown(child);
    if (md) blocks.push(md);
  });
  pushInline();
  return blocks.join('\n\n');
}

/** What the rich editor holds, back as Markdown. Accepts an element or an HTML string. */
export function htmlToMarkdown(input: Element | string): string {
  let root: Element;
  if (typeof input === 'string') {
    const doc = new DOMParser().parseFromString(`<div>${input}</div>`, 'text/html');
    root = doc.body.firstElementChild ?? doc.body;
  } else {
    root = input;
  }
  return childrenToMarkdown(root)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Words in a Markdown text, for the document's footer. */
export function wordCount(markdown: string): number {
  const words = markdown.replace(/[#>*_`~|[\]()-]/g, ' ').match(/[\p{L}\p{N}]+/gu);
  return words ? words.length : 0;
}

/** A title for a document that has none: its first heading, or its first words. */
export function titleOf(markdown: string, fallback: string): string {
  const heading = markdown.match(/^\s*#{1,6}\s+(.+)$/m);
  if (heading) return heading[1].trim().slice(0, 80);
  const first = markdown
    .trim()
    .split('\n')[0]
    ?.replace(/[#>*_`~]/g, '')
    .trim();
  return first ? first.slice(0, 60) : fallback;
}

/**
 * A task's result as a document. The brain answers with what to say first and the
 * report after a "Detalle:" heading (agent `brain/bridge.py`); the report is the
 * document. The spoken lines are dropped when the report has a title of its own,
 * and kept as an opening quote when it does not.
 */
export function reportOf(result: string): string {
  const match = result.match(/(^|\n)[ \t]*\**Detalle:?\**[ \t]*(\n|$)/);
  if (!match || match.index === undefined) return result.trim();
  const body = result.slice(match.index + match[0].length).trim();
  if (!body) return result.trim();
  return composeReport(result.slice(0, match.index), body);
}

/**
 * The document for a report and the words spoken about it, as the agent sends them
 * apart (`brain_result.spoken` / `report`): the spoken lines go when the report has
 * a title of its own, and open it as a quote when it does not.
 */
export function composeReport(spoken: string, report: string): string {
  const said = spoken.trim();
  const body = report.trim();
  if (!said || /^#{1,6}\s/.test(body)) return body;
  return `${said
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')}\n\n${body}`;
}
