// -----------------------------------------------------------------------------
// Settings. The admin `config_schema` holds what applies to everyone (the
// language of the scene texts); each user's `account_schema` holds their
// AniList user name, the statuses followed and the language of the titles.
// Defaults mirror the manifest (test/manifest.test.js).
// -----------------------------------------------------------------------------

import { LIST_STATUSES } from './anilist.js';
import { TITLE_LANGUAGES } from './anime.js';

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const DEFAULT_CONFIG = {
  language: 'fr',
};

export const DEFAULT_ACCOUNT = {
  username: '',
  statuses: 'current_planning',
  title_language: 'romaji',
};

/** The admin settings, with defaults for anything missing or unknown. */
export function normalizeConfig(raw = {}) {
  const config = { ...DEFAULT_CONFIG };
  if (LANGUAGES.includes(raw?.language)) {
    config.language = raw.language;
  }
  return config;
}

/** A supported language, else the fallback. */
export function languageOf(value, fallback = DEFAULT_CONFIG.language) {
  const short = String(value ?? '')
    .slice(0, 2)
    .toLowerCase();
  return LANGUAGES.includes(short) ? short : fallback;
}

/**
 * The AniList user name of a setting: the name itself, `@name`, or the
 * address of the profile (`https://anilist.co/user/name/animelist`).
 * '' when there is none.
 */
export function parseUserName(text) {
  const value = String(text ?? '').trim();
  const fromUrl = value.match(/anilist\.co\/user\/([^/?#\s]+)/i);
  let name = fromUrl ? fromUrl[1] : value;
  try {
    name = decodeURIComponent(name);
  } catch {
    // A stray `%`: the name as typed.
  }
  name = name.replace(/^@/, '').trim();
  return name.slice(0, 50);
}

/** One user's account settings, with defaults for anything missing or unknown. */
export function normalizeAccount(raw = {}) {
  return {
    username: parseUserName(raw?.username),
    statuses: Object.hasOwn(LIST_STATUSES, raw?.statuses) ? raw.statuses : DEFAULT_ACCOUNT.statuses,
    title_language: TITLE_LANGUAGES.includes(raw?.title_language)
      ? raw.title_language
      : DEFAULT_ACCOUNT.title_language,
  };
}
