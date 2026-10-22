/** Local Vietnamese gift-line parser — copied from the host server (sodam-ai.service.ts).
 *  Used as the offline/no-key fallback for AI parse, exactly like the original. */
/** Shared with client parse-money — keep logic aligned for SV tests. */
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
    const UNIT: Record<string, number> = {
      nghìn: 1_000,
      nghin: 1_000,
      ngàn: 1_000,
      ngan: 1_000,
      k: 1_000,
      triệu: 1_000_000,
      trieu: 1_000_000,
      củ: 1_000_000,
      cu: 1_000_000,
      đồng: 1,
      dong: 1,
    };
    const mul = UNIT[unitKey] ?? 1;
    if (Number.isFinite(num)) {
      amountVnd = Math.round(num * mul);
      if (!amountMatch[2] && amountVnd > 0 && amountVnd < 10_000) amountVnd *= 1_000;
      namePart =
        `${raw.slice(0, amountMatch.index)} ${raw.slice(amountMatch.index + amountMatch[0].length)}`.trim();
    }
  } else {
    const m = raw
      .toLowerCase()
      .match(
        /((?:một|hai|ba|bốn|bon|năm|nam|sáu|sau|bảy|bay|tám|tam|chín|chin)\s+)?(trăm|tram)\s+(nghìn|nghin|ngàn|ngan)/,
      );
    if (m && m.index != null) {
      const DIGIT: Record<string, number> = {
        một: 1,
        hai: 2,
        ba: 3,
        bốn: 4,
        bon: 4,
        năm: 5,
        nam: 5,
        sáu: 6,
        sau: 6,
        bảy: 7,
        bay: 7,
        tám: 8,
        tam: 8,
        chín: 9,
        chin: 9,
      };
      const hundreds = DIGIT[(m[1] ?? 'một').trim()] ?? 1;
      amountVnd = hundreds * 100 * 1_000;
      namePart = raw.slice(0, m.index).trim();
    }
  }

  const name = namePart
    .replace(/[,:|-]+$/g, '')
    .replace(/^(ông|bà|anh|chị|cô|chú|bác)\s+/i, '')
    .trim();

  return { name: name.length >= 2 ? name : null, amountVnd };
}
