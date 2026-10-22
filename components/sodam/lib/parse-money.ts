/** Local Vietnamese gift-line parser (demo + offline fallback before AI). */

const UNIT: Record<string, number> = {
  nghìn: 1_000,
  nghin: 1_000,
  ngàn: 1_000,
  ngan: 1_000,
  k: 1_000,
  trăm: 100,
  tram: 100,
  triệu: 1_000_000,
  trieu: 1_000_000,
  củ: 1_000_000,
  cu: 1_000_000,
  đồng: 1,
  dong: 1,
};

const DIGIT_WORDS: Record<string, number> = {
  không: 0,
  mot: 1,
  một: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  bốn: 4,
  nam: 5,
  năm: 5,
  sau: 6,
  sáu: 6,
  bay: 7,
  bảy: 7,
  tam: 8,
  tám: 8,
  chin: 9,
  chín: 9,
  muoi: 10,
  mười: 10,
};

export function parseVietnameseGiftLine(text: string): {
  name: string | null;
  amountVnd: number | null;
} {
  const raw = text.trim().replace(/\s+/g, ' ');
  if (!raw) return { name: null, amountVnd: null };

  const amountMatch = raw.match(
    /(\d[\d.,]*)\s*(nghìn|nghin|ngàn|ngan|k|triệu|trieu|củ|cu|đồng|dong)?/i,
  );
  let amountVnd: number | null = null;
  let namePart = raw;

  if (amountMatch && amountMatch.index != null) {
    const num = Number(amountMatch[1].replace(/\./g, '').replace(/,/g, ''));
    const unitKey = (amountMatch[2] ?? 'đồng').toLowerCase();
    const mul = UNIT[unitKey] ?? 1;
    if (Number.isFinite(num)) {
      amountVnd = Math.round(num * mul);
      // Common shorthand: "500" at a wedding usually means 500k
      if (!amountMatch[2] && amountVnd > 0 && amountVnd < 10_000) {
        amountVnd *= 1_000;
      }
      namePart =
        `${raw.slice(0, amountMatch.index)} ${raw.slice(amountMatch.index + amountMatch[0].length)}`.trim();
    }
  } else {
    const wordAmount = parseWordAmount(raw);
    if (wordAmount) {
      amountVnd = wordAmount.amountVnd;
      namePart = wordAmount.namePart;
    }
  }

  const name = namePart
    .replace(/[,:|-]+$/g, '')
    .replace(/^(ông|bà|anh|chị|cô|chú|bác)\s+/i, '')
    .trim();

  return {
    name: name.length >= 2 ? name : null,
    amountVnd,
  };
}

function parseWordAmount(raw: string): { amountVnd: number; namePart: string } | null {
  const lower = raw.toLowerCase();
  for (const [word, mul] of Object.entries(UNIT)) {
    if (mul < 100) continue;
    const idx = lower.lastIndexOf(word);
    if (idx < 0) continue;
    const before = lower.slice(0, idx).trim();
    const tokens = before.split(/\s+/);
    const last = tokens[tokens.length - 1];
    const digit = DIGIT_WORDS[last ?? ''] ?? Number(last);
    if (!Number.isFinite(digit)) continue;
    let amount = digit * mul;
    // "năm trăm nghìn"
    if (
      tokens.length >= 2 &&
      (tokens[tokens.length - 2] === 'trăm' || tokens[tokens.length - 2] === 'tram')
    ) {
      const hundreds =
        DIGIT_WORDS[tokens[tokens.length - 3] ?? ''] ?? Number(tokens[tokens.length - 3]);
      if (Number.isFinite(hundreds)) amount = hundreds * 100 * mul;
    }
    if (
      word === 'nghìn' ||
      word === 'nghin' ||
      word === 'ngàn' ||
      word === 'ngan' ||
      word === 'k'
    ) {
      // already scaled
    }
    const namePart = raw.slice(0, raw.toLowerCase().lastIndexOf(last ?? '')).trim();
    // Better: strip from digit word through unit
    const cut = lower.lastIndexOf(String(last));
    return { amountVnd: amount, namePart: raw.slice(0, cut).trim() || namePart };
  }
  // "năm trăm nghìn" full phrase
  const m = lower.match(
    /((?:một|hai|ba|bốn|bon|năm|nam|sáu|sau|bảy|bay|tám|tam|chín|chin)\s+)?(trăm|tram)\s+(nghìn|nghin|ngàn|ngan)/,
  );
  if (m && m.index != null) {
    const hundreds = DIGIT_WORDS[(m[1] ?? 'một').trim()] ?? 1;
    return {
      amountVnd: hundreds * 100 * 1_000,
      namePart: raw.slice(0, m.index).trim(),
    };
  }
  return null;
}
