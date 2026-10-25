import { describe, expect, it } from 'vitest';

import { initialsDataUri } from './avatar';

/**
 * PersonAvatar initials — local, deterministic, zero-HTTP.
 *
 * The initials style (@dicebear/initials 9.4.3, lib/index.js) derives
 * its glyph from the seed alone (`getInitials(prng.seed.trim())`), so
 * the helper feeds it the person's real name for the glyph and pins
 * the background from the stable entity seed/id instead.
 *
 * Note on the "no http" assertions: the goal is that NOTHING is ever
 * fetched and no identity leaves the device — not that the SVG text
 * contains no URL-shaped strings. Two static strings in genuine
 * DiceBear output are therefore allowed (verified against the real
 * library output): the xmlns namespace identifiers
 * ("http://www.w3.org/2000/svg" etc.), and the CC0 attribution text
 * inside <metadata> (github.com/dicebear/dicebear,
 * creativecommons.org) — inert metadata text that an SVG-as-image
 * never fetches. Also allowed: url(#viewboxMask), an internal
 * fragment reference. What must never appear is an actual external
 * reference: the DiceBear HTTP API host, an <image> fetch, an
 * href/url() pointing at http(s), or a CSS @import.
 */
function decodeSvg(uri: string): string {
  return decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
}

function backgroundFill(svg: string): string | null {
  return svg.match(/<rect[^>]*fill="(#[0-9A-Fa-f]{6})"/)?.[1] ?? null;
}

describe('initialsDataUri — data URI shape', () => {
  it('returns an inline SVG data URI', () => {
    const uri = initialsDataUri('Nguyễn Văn An');
    expect(uri.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeSvg(uri)).toContain('<svg');
    expect(decodeSvg(uri)).toContain('viewBox="0 0 100 100"');
  });

  it('contains the correct initials of the real name', () => {
    expect(decodeSvg(initialsDataUri('Nguyễn Văn An'))).toContain('>NA</text>');
    expect(decodeSvg(initialsDataUri('Đặng Thu Hà'))).toContain('>ĐH</text>');
    expect(decodeSvg(initialsDataUri('Trần Bình'))).toContain('>TB</text>');
    // Single-word name: first two letters, like DiceBear getInitials.
    expect(decodeSvg(initialsDataUri('Madonna'))).toContain('>MA</text>');
  });

  it('is deterministic — same input, same output', () => {
    expect(initialsDataUri('Nguyễn Văn An', 'member-1')).toBe(
      initialsDataUri('Nguyễn Văn An', 'member-1'),
    );
    expect(initialsDataUri('Đặng Thu Hà')).toBe(initialsDataUri('Đặng Thu Hà'));
  });
});

describe('initialsDataUri — seed pins colour, name pins glyph', () => {
  it('keeps the glyph from the name regardless of the seed/id', () => {
    expect(decodeSvg(initialsDataUri('Nguyễn Văn An', 'member-123'))).toContain('>NA</text>');
    expect(decodeSvg(initialsDataUri('Nguyễn Văn An', 'another-id-999'))).toContain('>NA</text>');
  });

  it('gives different backgrounds for different seeds (at least one pair)', () => {
    const fills = new Set(
      ['id-1', 'id-2', 'id-3', 'id-4', 'id-5', 'id-6', 'id-7', 'id-8'].map((id) =>
        backgroundFill(decodeSvg(initialsDataUri('Nguyễn Văn An', id))),
      ),
    );
    expect(fills.size).toBeGreaterThan(1);
  });

  it('only uses backgrounds from the B′ neutral-gray ledger system', () => {
    const allowed = new Set(['#ECEFF2', '#E4E8EC', '#F6F8FA', '#D8DEE4', '#59636E']);
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const fill = backgroundFill(decodeSvg(initialsDataUri('Trần Bình', id)));
      expect(fill).not.toBeNull();
      expect(allowed.has(fill!)).toBe(true);
    }
  });
});

describe('initialsDataUri — Panel #02 T-02: lacquer purged from the identity layer', () => {
  it('never renders the retired lacquer hex B3352C for any seed', () => {
    // Sweep: 300 deterministic pseudo-ids (incl. cuid-shaped ones like the
    // production person ids) — no avatar SVG may contain the retired hex
    // in any role (fill or text colour).
    for (let i = 0; i < 300; i += 1) {
      const id = `cmvk${(i * 7919).toString(36)}person${i}`;
      const svg = decodeSvg(initialsDataUri('Nguyễn Văn An', id));
      expect(svg.toUpperCase()).not.toContain('B3352C');
      const fill = backgroundFill(svg);
      expect(fill).not.toBeNull();
      expect(['#ECEFF2', '#E4E8EC', '#F6F8FA', '#D8DEE4', '#59636E']).toContain(fill);
    }
  });

  it('is stable per person — interleaved calls for other people never shift a colour', () => {
    const before = initialsDataUri('Bác Năm', 'person-funeral-visitor');
    // Simulate other surfaces rendering other people in between.
    for (const other of ['person-1', 'person-2', 'person-3', 'person-4', 'person-5']) {
      initialsDataUri('Người Khác', other);
    }
    expect(initialsDataUri('Bác Năm', 'person-funeral-visitor')).toBe(before);
  });
});

describe('initialsDataUri — zero external references', () => {
  it('never references the DiceBear HTTP API or any external resource', () => {
    for (const name of ['Nguyễn Văn An', 'Đặng Thu Hà', 'Madonna']) {
      const uri = initialsDataUri(name, `seed-${name}`);
      const svg = decodeSvg(uri);
      expect(uri).not.toContain('api.dicebear.com');
      expect(svg).not.toContain('api.dicebear.com');
      expect(svg).not.toContain('<image');
      expect(svg).not.toMatch(/href\s*=\s*"https?:/);
      expect(svg).not.toMatch(/url\(\s*["']?https?:/);
      expect(svg).not.toContain('@import');
    }
  });
});
