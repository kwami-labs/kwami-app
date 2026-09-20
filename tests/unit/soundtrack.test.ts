import { beforeEach, describe, expect, it } from 'vitest';
import {
  FIRST_PLAY_KEY,
  INTRO_TRACK_ID,
  TRACK_DIR,
  TRACKS,
  introTrack,
  markPlayed,
  pickFirstTrack,
  pickTrack,
  playedBefore,
  youtubeVideoId,
} from '../../src/lib/soundtrack';

beforeEach(() => {
  localStorage.clear();
});

describe('the crate', () => {
  it('ships tracks', () => {
    expect(TRACKS.length).toBeGreaterThan(0);
  });

  it('gives every track a file under the track directory', () => {
    for (const track of TRACKS) {
      expect(track.src, track.id).toBe(`${TRACK_DIR}/${track.id}.mp3`);
    }
  });

  it('uses each id once', () => {
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(TRACKS.length);
  });

  it('names an artist and a title for every track, for the now-playing line', () => {
    for (const track of TRACKS) {
      expect(track.title, track.id).not.toBe('');
      expect(track.artist, track.id).not.toBe('');
    }
  });

  it('only ever points youtube credits at youtube', () => {
    for (const track of TRACKS) {
      if (!track.youtube) continue;
      expect(track.youtube, track.id).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=.+/);
    }
  });

  it('hands the backdrop player a watch id, and nothing else', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=Jq2IfkMr_x0')).toBe('Jq2IfkMr_x0');
    expect(youtubeVideoId('https://youtube.com/watch?v=ZE5zXLOyEOQ')).toBe('ZE5zXLOyEOQ');
    expect(youtubeVideoId('https://example.com/watch?v=Jq2IfkMr_x0')).toBeNull();
    expect(youtubeVideoId('https://www.youtube.com/watch?v=nope')).toBeNull();
    expect(youtubeVideoId(undefined)).toBeNull();
  });

  it('holds the intro record', () => {
    expect(introTrack().id).toBe(INTRO_TRACK_ID);
  });

  it('refuses a crate with no intro record', () => {
    const withoutIntro = TRACKS.filter((t) => t.id !== INTRO_TRACK_ID);
    expect(() => introTrack(withoutIntro)).toThrow(/missing from the crate/);
  });
});

describe('pickTrack', () => {
  it('never returns the track it was told to avoid', () => {
    const except = TRACKS[0]!;
    // Walk the whole [0, 1) range: no roll may land back on `except`.
    for (let i = 0; i < TRACKS.length * 4; i += 1) {
      const roll = i / (TRACKS.length * 4);
      expect(pickTrack(() => roll, except).id).not.toBe(except.id);
    }
  });

  it('still returns something when the crate holds only the avoided track', () => {
    const only = [TRACKS[0]!];
    expect(pickTrack(Math.random, only[0], only)).toBe(only[0]);
  });

  it('clamps a stub that hands back 1 instead of staying below it', () => {
    expect(pickTrack(() => 1)).toBe(TRACKS[TRACKS.length - 1]);
  });
});

describe('pickFirstTrack', () => {
  it('plays the intro record on a first ever press, and remembers it did', () => {
    expect(playedBefore()).toBe(false);
    expect(pickFirstTrack(() => 0.99).id).toBe(INTRO_TRACK_ID);
    expect(playedBefore()).toBe(true);
    expect(localStorage.getItem(FIRST_PLAY_KEY)).toBe('1');
  });

  it('is random once the visitor has pressed play before', () => {
    markPlayed();
    expect(pickFirstTrack(() => 0).id).toBe(TRACKS[0]!.id);
  });

  it('avoids the current track once past the first press', () => {
    markPlayed();
    const except = TRACKS[0]!;
    expect(pickFirstTrack(() => 0, except).id).not.toBe(except.id);
  });
});
