import { useHudStore, type HudWidget } from '@/stores/hud';
import { classifyUrl, hostOf, safeHttpUrl, youtubeStart } from './media';

/**
 * An address on Jarvis's screen, in the window that suits it: a video in the player,
 * a picture in the viewer, anything else (PDFs included: the web view renders them)
 * in the web window. Null for an address that is not http(s).
 */
export function openUrlInHud(
  raw: string,
  options: { title?: string; source?: 'agent' | 'user'; kind?: string; start?: number } = {},
): HudWidget | null {
  const url = safeHttpUrl(raw);
  if (!url) return null;
  const hud = useHudStore();
  const detected = classifyUrl(url);
  const wanted = options.kind;
  const kind =
    wanted === 'video' || wanted === 'image' || wanted === 'web'
      ? wanted
      : detected === 'youtube' || detected === 'video' || detected === 'audio'
        ? 'video'
        : detected === 'image'
          ? 'image'
          : 'web';
  const title = (options.title ?? '').trim() || hostOf(url) || url;
  return hud.open({
    kind,
    url,
    title,
    source: options.source ?? 'user',
    start: options.start ?? (kind === 'video' ? youtubeStart(url) || undefined : undefined),
  });
}
