// -----------------------------------------------------------------------------
// Pure functions over AniList answers: an anime and its airings turned into
// small plain objects, in the time zone of Gladys (TZ). AniList gives every
// airing as a UNIX time (the broadcast in Japan), so the conversion to the
// local time is exact. The rest of the integration never reads a raw
// AniList object.
// -----------------------------------------------------------------------------

import { addDays, daysBetween, localDate } from './time.js';

// Status codes of the integration (frozen: scene outputs carry their labels).
export const STATUS_CODES = [
  'scheduled',
  'releasing',
  'not_yet_released',
  'hiatus',
  'finished',
  'cancelled',
];
export const TITLE_LANGUAGES = ['romaji', 'english', 'native'];
// Airings kept behind today: the calendar shows the last two weeks.
export const PAST_DAYS = 14;
// Used when AniList knows no episode duration (an anime not aired yet).
const DEFAULT_DURATION_MIN = 24;

/** Lowercase, without accents nor extra blanks: "Sousou  no Frieren" matches "sousou no frieren". */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** `2027-10`, `2027` or '' from an AniList fuzzy date. */
export function fuzzyDate(date) {
  if (!Number.isInteger(date?.year)) {
    return '';
  }
  const pad = (number) => String(number).padStart(2, '0');
  let text = String(date.year);
  if (Number.isInteger(date.month)) {
    text += `-${pad(date.month)}`;
    if (Number.isInteger(date.day)) {
      text += `-${pad(date.day)}`;
    }
  }
  return text;
}

/**
 * One airing: an episode at a time, lasting the episode duration.
 * @param {{ id: number, airingAt: number, episode: number }} raw
 * @param {{ duration?: number | null }} [anime]
 */
export function normalizeAiring(raw, anime = {}) {
  if (!raw?.id || !Number.isFinite(raw.airingAt)) {
    return null;
  }
  const start = raw.airingAt * 1000;
  const duration = Number(anime.duration) || DEFAULT_DURATION_MIN;
  return {
    id: raw.id,
    episode: Number.isInteger(raw.episode) ? raw.episode : 0,
    start,
    end: start + duration * 60_000,
    day: localDate(start),
  };
}

/** An anime of a list (`MediaList.media`). */
export function normalizeAnime(raw) {
  const titles = {
    romaji: String(raw.title?.romaji ?? '').trim(),
    english: String(raw.title?.english ?? '').trim(),
    native: String(raw.title?.native ?? '').trim(),
  };
  const base = {
    id: raw.id,
    titles,
    status: String(raw.status ?? ''),
    format: String(raw.format ?? ''),
    episodes: Number.isInteger(raw.episodes) ? raw.episodes : null,
    duration: Number(raw.duration) || null,
    url:
      typeof raw.siteUrl === 'string' && raw.siteUrl.startsWith('https://')
        ? raw.siteUrl
        : `https://anilist.co/anime/${raw.id}`,
    startDate: fuzzyDate(raw.startDate),
    endDate: fuzzyDate(raw.endDate),
  };
  const next = normalizeAiring(raw.nextAiringEpisode, base);
  return { ...base, next, statusCode: statusCode(base.status, Boolean(next)) };
}

/** The title in the chosen language, else the first known one. */
export function titleOf(anime, language = 'romaji') {
  const order = [language, ...TITLE_LANGUAGES.filter((entry) => entry !== language)];
  for (const key of order) {
    if (anime.titles?.[key]) {
      return anime.titles[key];
    }
  }
  return `#${anime.id}`;
}

/** The integration's status code of an anime. */
export function statusCode(status, hasNext) {
  if (hasNext) {
    return 'scheduled';
  }
  switch (status) {
    case 'FINISHED':
      return 'finished';
    case 'CANCELLED':
      return 'cancelled';
    case 'HIATUS':
      return 'hiatus';
    case 'NOT_YET_RELEASED':
      return 'not_yet_released';
    default:
      return 'releasing';
  }
}

/**
 * Whether the calendar needs the airings of an anime: one not over, or over
 * in the last PAST_DAYS (its last episodes stay in the window). Finished
 * anime, most of a planning list, cost no request.
 */
export function mayAir(anime, today) {
  if (anime.next || !['FINISHED', 'CANCELLED'].includes(anime.status)) {
    return true;
  }
  const end = /^\d{4}-\d{2}-\d{2}$/.test(anime.endDate) ? anime.endDate : null;
  return Boolean(end && end >= addDays(today, -PAST_DAYS - 1));
}

/** `7/12`, or `7` when the number of episodes is not known. */
export function episodeOf(airing, anime) {
  return anime.episodes ? `${airing.episode}/${anime.episodes}` : String(airing.episode);
}

/** The next airing at `now` (one airing now included), or null. */
export function nextAiring(airings, now) {
  return airings.find((airing) => airing.end > now) ?? null;
}

/** The last airing over before `now`, or null. */
export function lastAiring(airings, now) {
  let last = null;
  for (const airing of airings) {
    if (airing.end <= now) {
      last = airing;
    }
  }
  return last;
}

/** Whole days from today to the day of an airing (0 today). */
export function daysUntil(airing, now) {
  return daysBetween(localDate(now), airing.day);
}
