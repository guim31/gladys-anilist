// -----------------------------------------------------------------------------
// What the household follows on AniList, kept in memory: the users' lists
// (one request each) and the airing schedules of the anime that may air
// (one request per 50 airings, all users together). Everything is read
// again after REFRESH_MS: a household of three users costs a handful of
// requests every 3 hours, far below the 30 requests a minute of AniList.
// -----------------------------------------------------------------------------

import { LIST_STATUSES } from './anilist.js';
import { PAST_DAYS, fold, normalizeAiring, normalizeAnime } from './anime.js';
import { addDays, localDate, localTime } from './time.js';

export const REFRESH_MS = 3 * 3_600_000;
// Read during the previous refresh (a sync takes a while): due at this one.
const FRESH_MS = REFRESH_MS - 15 * 60_000;
// Days of airings read ahead of today. AniList dates most anime a few weeks
// ahead; a long-running one (Crayon Shin-chan) is dated a year ahead, which
// would fill the calendar with 50 weekly episodes.
export const FUTURE_DAYS = 92;
// The gap after the last known airing that makes a new one an announcement.
const BREAK_MS = 14 * 86_400_000;
// After a failed reading, a list is not asked again before this delay.
const FAILURE_BACKOFF_MS = 10 * 60_000;

export class Catalog {
  /**
   * @param {object} options
   * @param {ReturnType<import('./anilist.js').createAniList>} options.client
   * @param {() => number} options.now
   */
  constructor({ client, now }) {
    this.client = client;
    this.now = now;
    /** `<folded user name>|<statuses>` → { name, entries, error, fetchedAt } */
    this.lists = new Map();
    /** list key → time of the last failed reading */
    this.failedAt = new Map();
    /** anime id → normalized anime (the last list that held it) */
    this.anime = new Map();
    /** anime id → { list: airings by time, fetchedAt } */
    this.airings = new Map();
    /** anime that had no next episode and now have one */
    this.announced = [];
  }

  /**
   * A user's public list. Cached; an unknown user or a private list is an
   * answer too (`error`), cached like a list.
   * @returns {Promise<{ name: string, entries: { anime: object, progress: number }[], error?: string }>}
   *   throws when AniList cannot be read and nothing is cached
   */
  async loadList(userName, statusKey, { force = false } = {}) {
    const key = Catalog.listKey(userName, statusKey);
    const cached = this.lists.get(key);
    const now = this.now();
    if (cached && !force && now - cached.fetchedAt < FRESH_MS) {
      return cached;
    }
    if (cached && !force && now - (this.failedAt.get(key) ?? -Infinity) < FAILURE_BACKOFF_MS) {
      return cached;
    }
    let entry;
    try {
      const result = await this.client.list(userName, LIST_STATUSES[statusKey]);
      const entries = [];
      const seen = new Set();
      for (const raw of result.entries) {
        const anime = this.update(normalizeAnime(raw.media));
        if (!seen.has(anime.id)) {
          seen.add(anime.id);
          entries.push({ anime, progress: Number(raw.progress) || 0 });
        }
      }
      entry = { name: String(result.user.name ?? userName), entries, fetchedAt: now };
    } catch (err) {
      if (!err?.reason) {
        this.failedAt.set(key, now);
        if (cached) {
          return cached;
        }
        throw err;
      }
      entry = { name: userName, entries: [], error: err.reason, fetchedAt: now };
    }
    this.lists.set(key, entry);
    this.failedAt.delete(key);
    return entry;
  }

  /**
   * Keeps the latest reading of an anime, and notes it when it is back on
   * the schedule: it had no next episode at the last reading (a first date,
   * a return from a hiatus), or that one aired and the new one comes after
   * a break. An anime dated one week at a time is never announced.
   */
  update(anime) {
    const cached = this.anime.get(anime.id);
    const now = this.now();
    const before = cached?.next;
    if (
      cached &&
      anime.next &&
      anime.next.start > now &&
      (!before || (before.end <= now && anime.next.start - before.end >= BREAK_MS))
    ) {
      this.announced.push(anime);
    }
    this.anime.set(anime.id, anime);
    return anime;
  }

  /**
   * Reads the airings of the anime whose cache is old, in one batch.
   * Throws when AniList cannot be read and one of them has no cache.
   */
  async loadAirings(ids, { force = false } = {}) {
    const now = this.now();
    const stale = ids.filter((id) => {
      const cached = this.airings.get(id);
      return force || !cached || now - cached.fetchedAt >= FRESH_MS;
    });
    if (stale.length === 0) {
      return;
    }
    const today = localDate(now);
    const from = localTime(addDays(today, -PAST_DAYS), 0);
    const to = localTime(addDays(today, FUTURE_DAYS + 1), 0);
    let raw;
    try {
      raw = await this.client.schedules(stale, from, to);
    } catch (err) {
      if (stale.some((id) => !this.airings.has(id))) {
        throw err;
      }
      return;
    }
    const byAnime = new Map(stale.map((id) => [id, []]));
    for (const entry of raw) {
      const airing = normalizeAiring(entry, this.anime.get(entry.mediaId));
      if (airing && byAnime.has(entry.mediaId)) {
        byAnime.get(entry.mediaId).push(airing);
      }
    }
    for (const [id, list] of byAnime) {
      const unique = [...new Map(list.map((airing) => [airing.id, airing])).values()];
      unique.sort((a, b) => a.start - b.start || a.id - b.id);
      this.airings.set(id, { list: unique, fetchedAt: now });
    }
  }

  /** The cached airings of an anime, by time. */
  airingsOf(id) {
    return this.airings.get(id)?.list ?? [];
  }

  /** The announcements since the last call. */
  takeAnnounced() {
    const list = this.announced;
    this.announced = [];
    return list;
  }

  /** The cache key of a list. */
  static listKey(userName, statusKey) {
    return `${fold(userName)}|${statusKey}`;
  }

  /** Forgets the lists nobody reads and the anime nobody follows any more. */
  keepOnly(ids, listKeys) {
    for (const key of this.lists.keys()) {
      if (!listKeys.has(key)) {
        this.lists.delete(key);
        this.failedAt.delete(key);
      }
    }
    for (const map of [this.anime, this.airings]) {
      for (const id of map.keys()) {
        if (!ids.has(id)) {
          map.delete(id);
        }
      }
    }
  }
}
