import type { Period } from './types';

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

const moneyFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const integerFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const litersFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** 1 234,5 ₽; with sign: +1 234 ₽ / −1 234 ₽. */
export function money(value: number, sign = false) {
  const prefix = sign && value > 0 ? '+' : sign && value < 0 ? '−' : !sign && value < 0 ? '−' : '';
  return `${prefix}${moneyFormat.format(Math.abs(value))} ₽`;
}

export function moneyRounded(value: number) {
  return `${value < 0 ? '−' : ''}${integerFormat.format(Math.abs(Math.round(value)))} ₽`;
}

export function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (value >= 1000) return `${Number((value / 1000).toFixed(value >= 10_000 ? 0 : 2)).toLocaleString('ru-RU')}k`;
  return String(Math.round(value));
}

export const integer = (value: number) => integerFormat.format(value);
export const liters = (value: number) => litersFormat.format(value);

/** Today's date as YYYY-MM-DD in the browser's local time (not UTC). */
export function todayIso(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shiftIso(iso: string, days: number) {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return todayIso(date);
}

export function parseIso(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function dateShort(iso: string) {
  const date = parseIso(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()].slice(0, 3)}${sameYear ? '' : ` ${date.getFullYear()}`}`;
}

export function dateLong(iso: string) {
  const date = parseIso(iso);
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
}

/** «Сегодня», «Вчера» or «18 октября, сб». */
export function dayLabel(iso: string) {
  const today = todayIso();
  if (iso === today) return 'Сегодня';
  if (iso === shiftIso(today, -1)) return 'Вчера';
  const date = parseIso(iso);
  const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date);
  const year = date.getFullYear() === new Date().getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}${year}, ${weekday}`;
}

export function currentPeriod(): Period {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function periodTitle({ year, month }: Period) {
  return month ? `${MONTHS[month - 1]} ${year}` : `${year} год`;
}

export function periodKey({ year, month }: Period) {
  return `${year}-${month ?? 'all'}`;
}

export function shiftPeriod({ year, month }: Period, step: number): Period {
  if (month === null) return { year: year + step, month: null };
  const index = year * 12 + (month - 1) + step;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function isFuturePeriod(period: Period) {
  const now = currentPeriod();
  if (period.month === null) return period.year > now.year;
  return period.year * 12 + period.month > now.year * 12 + (now.month ?? 1);
}

/** Parses «1 234,50» or «1234.5» typed on any keyboard. */
export function parseAmount(raw: string) {
  const value = Number(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : NaN;
}

export function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
