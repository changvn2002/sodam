/**
 * Chuyển đổi Dương lịch → Âm lịch Việt Nam.
 *
 * Thuật toán: lịch âm Việt Nam theo múi giờ UTC+7 của Hồ Ngọc Đức
 * (amlich / "Vietnamese Lunar Calendar"), bản tham chiếu dùng rộng rãi:
 * tính ngày sóc (new moon) bằng chuỗi thiên văn rút gọn, tháng 11 âm lịch
 * là tháng chứa Đông chí, tháng nhuận là tháng không có trung khí.
 * Khác với lịch Trung Quốc ở múi giờ (+7 thay vì +8) nên một số ngày
 * mùng 1 và tháng nhuận lệch nhau — bắt buộc dùng tz = 7 cho Việt Nam.
 *
 * Logic thuần, không phụ thuộc thư viện ngoài, chạy được cả client lẫn test.
 */

const PI = Math.PI;
/** Múi giờ Việt Nam — cố định, không lấy theo máy người dùng. */
const TIME_ZONE = 7;

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  /** true nếu rơi vào tháng nhuận. */
  leap: boolean;
}

/** Số ngày Julian từ ngày dương lịch (dd/mm/yyyy). */
function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  if (jd < 2299161) {
    jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  }
  return jd;
}

/** Ngày Julian (số nguyên) của ngày sóc thứ k theo giờ Việt Nam. */
function getNewMoonDay(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 -= 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(2 * dr * Mpr);
  C1 -= 0.0004 * Math.sin(3 * dr * Mpr);
  C1 -= 0.0004 * Math.sin((2 * M - F) * dr);
  C1 -= 0.0006 * Math.sin((2 * M + F) * dr);
  C1 += 0.001 * Math.sin((2 * Mpr + F) * dr);
  C1 += 0.0005 * Math.sin((2 * Mpr - M) * dr);
  let deltaT: number;
  if (T < -11) {
    deltaT = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltaT = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  return Math.floor(jd1 + C1 - deltaT + 0.5 + TIME_ZONE / 24);
}

/** Cung hoàng đạo mặt trời (0–11) của một ngày Julian — để xác định trung khí. */
function getSunLongitude(jdn: number): number {
  const T = (jdn - 2451545.5 - TIME_ZONE / 24) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L -= PI * 2 * Math.floor(L / (PI * 2));
  return Math.floor(L / (PI / 6));
}

/** Ngày mùng 1 của tháng 11 âm lịch năm yy (tháng chứa Đông chí). */
function getLunarMonth11(yy: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = getNewMoonDay(k);
  if (getSunLongitude(nm) >= 9) {
    nm = getNewMoonDay(k - 1);
  }
  return nm;
}

/** Vị trí tháng nhuận tính từ tháng 11 (a11) trong năm âm lịch có 13 tháng. */
function getLeapMonthOffset(a11: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i));
  do {
    last = arc;
    i += 1;
    arc = getSunLongitude(getNewMoonDay(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

/**
 * Đổi ngày dương lịch sang âm lịch Việt Nam.
 * Ví dụ: solarToLunar(10, 2, 2024) → { day: 1, month: 1, year: 2024, leap: false } (Tết Giáp Thìn).
 */
export function solarToLunar(day: number, month: number, year: number): LunarDate {
  const dayNumber = jdFromDate(day, month, year);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k);
  }

  let a11 = getLunarMonth11(year);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = year;
    a11 = getLunarMonth11(year - 1);
  } else {
    lunarYear = year + 1;
    b11 = getLunarMonth11(year + 1);
  }

  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarLeap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) lunarLeap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;

  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

/**
 * Chuỗi hiển thị ngày âm kiểu Việt, ví dụ "15/8 âm lịch",
 * tháng nhuận: "1/2 nhuận âm lịch".
 */
export function formatLunarVi(day: number, month: number, leap = false): string {
  return `${day}/${month}${leap ? ' nhuận' : ''} âm lịch`;
}
