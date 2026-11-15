// -----------------------------------------------------------------------------
// Scene triggers and action (manifest `scene_triggers` / `scene_actions`).
//
// The core already offers "an event is coming" on any shared calendar, which
// the "Anime" calendars feed. What the integration adds, with the anime and
// the episode number as variables:
//
//   - trigger `episode_today`: a followed anime has an episode today, fired
//     in the morning (MORNING_MINUTES) or at its air time, the `moment`
//     filter choosing. With a "Send a message" action, the users chosen in
//     the scene are told the day it airs;
//   - trigger `episode_announced`: an anime that had no next episode gets
//     one (a first air date, a return from a hiatus);
//   - action `next_episode`: the next episode of an anime (or of all of
//     them), with the days left and its status. `found` and `days_left` are
//     numbers: the core's "condition on variables" compares strictly.
//
// Like the core's calendar scenes, only SHARED calendars are involved: a
// scene is household business, a private calendar stays private.
// -----------------------------------------------------------------------------

import { STATUS_TEXT, formatTime, formatWhen, pick } from './i18n.js';
import { daysUntil, episodeOf, fold, lastAiring } from './anime.js';
import { nextOf } from './syncer.js';
import { localDate, localTime } from './time.js';

export const TRIGGERS = {
  EPISODE_TODAY: 'episode_today',
  EPISODE_ANNOUNCED: 'episode_announced',
};
export const SCENE_TRIGGER_KEYS = Object.values(TRIGGERS);
export const MOMENTS = ['morning', 'air_time'];
// "This morning": 09:00 local.
export const MORNING_MINUTES = 9 * 60;
// A moment is reported within this delay of its time, never later: a restart
// hours later fires nothing.
export const FRESH_MS = 5 * 60_000;

/** The variables shared by the triggers. */
function airingData(entry, airing, language) {
  return {
    anime: entry.title,
    episode: airing.episode,
    episodes: entry.anime.episodes ?? 0,
    date: formatWhen(airing, language),
    time: formatTime(airing),
    url: entry.anime.url,
  };
}

/** When a moment of an airing falls. */
export function momentTime(airing, moment) {
  return moment === 'air_time' ? airing.start : localTime(airing.day, MORNING_MINUTES);
}

/**
 * Watches the airings of the shared anime and reports their moments of the
 * day. Each (airing, moment) fires once.
 */
export class AirWatcher {
  constructor() {
    /** `<airing id>:<moment>` → time of the moment */
    this.fired = new Map();
  }

  /**
   * @param {ReturnType<import('./syncer.js').Syncer['sharedAnime']>} entries
   * @returns {{ key: string, data: object }[]}
   */
  look(entries, language, now) {
    const events = [];
    const today = localDate(now);
    for (const entry of entries) {
      for (const airing of entry.airings) {
        if (airing.day !== today) {
          continue;
        }
        for (const moment of MOMENTS) {
          const key = `${airing.id}:${moment}`;
          const at = momentTime(airing, moment);
          if (this.fired.has(key) || at > now || now - at > FRESH_MS) {
            continue;
          }
          this.fired.set(key, at);
          events.push({
            key: TRIGGERS.EPISODE_TODAY,
            data: {
              ...airingData(entry, airing, language),
              moment,
              users: entry.followers.join(', '),
            },
          });
        }
      }
    }
    for (const [key, at] of this.fired) {
      if (now - at > 2 * 86_400_000) {
        this.fired.delete(key);
      }
    }
    return events;
  }
}

/** The scene event of an anime back on the schedule. */
export function announcedEvent(entry, language, now) {
  const airing = entry.anime.next;
  return {
    key: TRIGGERS.EPISODE_ANNOUNCED,
    data: {
      ...airingData(entry, airing, language),
      days_left: daysUntil(airing, now),
      users: entry.followers.join(', '),
    },
  };
}

/** The titles an anime answers to: the chosen one and its other titles. */
function titlesOf(entry) {
  return [entry.title, ...Object.values(entry.anime.titles)].map(fold).filter(Boolean);
}

/** The shared anime a scene asks for: same title (any language), else a title starting with it. */
export function findAnime(entries, title) {
  const wanted = fold(title);
  return (
    entries.find((entry) => titlesOf(entry).includes(wanted)) ??
    entries.find((entry) => titlesOf(entry).some((candidate) => candidate.startsWith(wanted)))
  );
}

/** Whether a scene filter or a widget setting names this anime (any of its titles). */
export function matchesAnime(entry, title) {
  return titlesOf(entry).includes(fold(title));
}

const EMPTY_STATUS = {
  found: 0,
  anime: '',
  episode: 0,
  episodes: 0,
  date: '',
  time: '',
  days_left: -1,
  status: '',
  last_episode: 0,
};

/** Where an anime stands at `now`, for the `next_episode` action and the widget. */
export function animeStatus(entry, language, now) {
  const next = nextOf(entry, now);
  const last = lastAiring(entry.airings, now);
  const code = next
    ? 'scheduled'
    : entry.anime.statusCode === 'scheduled'
      ? 'releasing'
      : entry.anime.statusCode;
  return {
    found: 1,
    anime: entry.title,
    episode: next?.episode ?? 0,
    episodes: entry.anime.episodes ?? 0,
    date: next ? formatWhen(next, language) : '',
    time: next ? formatTime(next) : '',
    days_left: next ? Math.max(0, daysUntil(next, now)) : -1,
    status: pick(STATUS_TEXT, language)[code],
    last_episode: last?.episode ?? 0,
    statusCode: code,
    next,
    label: next ? episodeOf(next, entry.anime) : '',
  };
}

export const SCENE_ACTIONS = {
  /**
   * @param {{ syncer: import('./syncer.js').Syncer, config: object, now: number }} context
   * @param {{ anime?: string }} fields
   */
  async next_episode({ syncer, config, now }, fields = {}) {
    const entries = syncer.sharedAnime();
    let entry;
    if (fold(fields.anime)) {
      entry = findAnime(entries, fields.anime);
    } else {
      // No anime named: the soonest next episode of all.
      entry = entries
        .map((candidate) => ({ candidate, next: nextOf(candidate, now) }))
        .filter(({ next }) => next)
        .sort((a, b) => a.next.start - b.next.start)[0]?.candidate;
    }
    if (!entry) {
      return { ...EMPTY_STATUS };
    }
    // eslint-disable-next-line no-unused-vars
    const { statusCode, next, label, ...status } = animeStatus(entry, config.language, now);
    return status;
  },
};
