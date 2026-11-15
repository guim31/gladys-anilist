// -----------------------------------------------------------------------------
// Synchronization: for every user who enabled the integration, one Gladys
// calendar, "Anime", filled with the airings of the anime of their AniList
// list over a sliding window (two weeks back, three months ahead). Every
// publication carries the window, so the core prunes what is no longer
// there (an anime removed from the list, an airing moved).
//
// Identifiers: the calendar is `<user>:anime`, an airing
// `<user>:airing-<AniList airing id>`, both under the integration prefix.
// Republishing the same window is a no-op upsert.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { PAST_DAYS, episodeOf, mayAir, nextAiring, titleOf } from './anime.js';
import { Catalog, FUTURE_DAYS } from './catalog.js';
import { languageOf, normalizeAccount } from './config.js';
import { TEXT, pick } from './i18n.js';
import { addDays, localDate, localTime } from './time.js';

const logger = createLogger({ name: 'sync' });

// The core takes 500 events per request, and a window is one request.
export const MAX_EVENTS = 500;
// AniList's blue.
export const COLOR = '#02a9ff';
const MAX_DESCRIPTION = 500;

/** A short reason for the logs, never a secret (there is none here). */
export const describe = (err) => err?.message ?? String(err);

/**
 * Write limiter: the core accepts 30 calendar writes per minute per
 * integration (429 beyond). Keeps a margin, waits when the minute is full.
 */
export function createLimiter({ now = Date.now, sleep, perMinute = 25 } = {}) {
  const wait = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const stamps = [];
  return async function limit() {
    for (;;) {
      const t = now();
      while (stamps.length > 0 && stamps[0] <= t - 60_000) {
        stamps.shift();
      }
      if (stamps.length < perMinute) {
        stamps.push(t);
        return;
      }
      await wait(stamps[0] + 60_000 - t);
    }
  };
}

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The description of a user's calendar: whose list, what is coming, what went wrong. */
export function calendarDescription(user, language) {
  const text = pick(TEXT, language);
  // The notices first: the lists of titles can be long, and the description
  // is cut at 500 characters.
  const lines = [];
  if (!user.username) {
    lines.push(text.none);
  } else if (user.error === 'not_found') {
    lines.push(text.notFound(user.username));
  } else if (user.error === 'private') {
    lines.push(text.private(user.username));
  } else if (user.unavailable) {
    lines.push(text.unavailable);
  }
  if (user.truncated > 0) {
    lines.push(`${text.truncated(user.truncated)}.`);
  }
  if (user.listName && !user.error) {
    lines.push(text.summary(user.listName, user.total));
    const coming = user.items.filter((item) => item.anime.next || item.airings.length > 0);
    if (coming.length > 0) {
      lines.push(`${text.coming} ${coming.map((item) => item.title).join(', ')}.`);
    }
    const undated = user.items.filter(
      (item) => item.anime.statusCode === 'not_yet_released' && item.airings.length === 0,
    );
    if (undated.length > 0) {
      const list = undated.map(({ title, anime }) =>
        anime.startDate ? `${title} (${anime.startDate})` : title,
      );
      lines.push(`${text.undated} ${list.join(', ')}.`);
    }
  }
  const credit = text.credit;
  return `${truncate(lines.join('\n'), MAX_DESCRIPTION - credit.length - 1)}\n${credit}`;
}

/** The name of an airing event: `Sousou no Frieren · Épisode 7/28`. */
export function eventName(item, airing, language) {
  return truncate(
    `${item.title} · ${pick(TEXT, language).episode(episodeOf(airing, item.anime))}`,
    200,
  );
}

export class Syncer {
  /**
   * @param {object} options
   * @param {import('@gladysassistant/integration-sdk').GladysIntegration} options.gladys
   * @param {Catalog} options.catalog
   * @param {() => object} options.getConfig normalized admin settings
   * @param {() => number} options.now
   * @param {() => Promise<void>} [options.limit] write limiter
   */
  constructor({ gladys, catalog, getConfig, now, limit }) {
    this.gladys = gladys;
    this.catalog = catalog;
    this.getConfig = getConfig;
    this.now = now;
    this.limit = limit ?? (async () => {});
    /** userSelector → { selector, name, language, username, items, shared, sync, ... } */
    this.users = new Map();
    this.ready = false;
    this.running = Promise.resolve();
  }

  /** Runs the synchronizations one after the other. */
  queue(task) {
    const run = this.running.then(task, task);
    this.running = run.catch(() => {});
    return run;
  }

  /** Every enabled user, re-read from the core (the resync contract). */
  syncAll({ force = false } = {}) {
    return this.queue(async () => {
      // "Check" reads each list and each anime once, however many users.
      const forced = force ? { lists: new Set(), anime: new Set() } : null;
      const accounts = await this.gladys.getCalendarAccounts();
      const calendars = await this.gladys.getCalendars();
      const enabled = new Set(accounts.map((account) => account.user.selector));
      for (const selector of this.users.keys()) {
        if (!enabled.has(selector)) {
          this.users.delete(selector);
        }
      }
      const failures = [];
      for (const account of accounts) {
        const own = calendars.filter((calendar) => calendar.user === account.user.selector);
        try {
          await this.syncAccount(account, own, { forced });
        } catch (err) {
          failures.push(`${account.user.selector}: ${describe(err)}`);
        }
      }
      this.prune();
      this.ready = true;
      if (failures.length > 0) {
        throw new Error(failures.join('; '));
      }
      return accounts.length;
    });
  }

  /** One user, after they enabled, disabled or changed their account. */
  syncUser(selector) {
    return this.queue(async () => {
      const account = (await this.gladys.getCalendarAccounts()).find(
        (entry) => entry.user.selector === selector,
      );
      if (!account) {
        // Disabled: the core already destroyed their calendar.
        this.users.delete(selector);
        this.prune();
        return false;
      }
      await this.syncAccount(account, await this.gladys.getCalendars(selector));
      this.prune();
      return true;
    });
  }

  /** The catalog keeps what the users still follow. */
  prune() {
    const users = [...this.users.values()];
    this.catalog.keepOnly(
      new Set(users.flatMap((user) => user.items.map((item) => item.anime.id))),
      new Set(
        users
          .filter((user) => user.username)
          .map((user) => Catalog.listKey(user.username, user.statuses)),
      ),
    );
  }

  calendarId(selector) {
    return this.gladys.externalId(`${selector}:anime`);
  }

  /** Reads the list and the airings of one user. Never throws. */
  async read(settings, forced) {
    const result = {
      items: [],
      total: 0,
      listName: '',
      error: null,
      unavailable: false,
      stale: false,
    };
    if (!settings.username) {
      return result;
    }
    let list;
    try {
      const key = Catalog.listKey(settings.username, settings.statuses);
      const force = forced !== null && !forced.lists.has(key);
      forced?.lists.add(key);
      list = await this.catalog.loadList(settings.username, settings.statuses, { force });
    } catch (err) {
      logger.debug(`List of ${settings.username} not read: ${describe(err)}`);
      result.unavailable = true;
      return result;
    }
    result.stale = list.stale === true;
    result.listName = list.name;
    result.error = list.error ?? null;
    result.total = list.entries.length;
    const today = localDate(this.now());
    const airing = list.entries.filter(({ anime }) => mayAir(anime, today));
    try {
      const ids = airing.map(({ anime }) => anime.id);
      const toForce = forced ? ids.filter((id) => !forced.anime.has(id)) : [];
      toForce.forEach((id) => forced.anime.add(id));
      const kept = [
        await this.catalog.loadAirings(toForce, { force: true }),
        await this.catalog.loadAirings(ids),
      ];
      result.stale ||= kept.includes(true);
    } catch (err) {
      logger.debug(`Airings of ${settings.username} not read: ${describe(err)}`);
      result.unavailable = true;
    }
    result.items = airing.map(({ anime, progress }) => ({
      anime,
      progress,
      title: titleOf(anime, settings.title_language),
      airings: this.catalog.airingsOf(anime.id),
    }));
    return result;
  }

  async syncAccount(account, existing, { forced = null } = {}) {
    const { selector } = account.user;
    const language = languageOf(account.user.language, this.getConfig().language);
    const settings = normalizeAccount(account.config);
    const read = await this.read(settings, forced);
    const user = {
      selector,
      name: account.user.first_name || selector,
      language,
      username: settings.username,
      statuses: settings.statuses,
      ...read,
    };

    const today = localDate(this.now());
    const from = localTime(addDays(today, -PAST_DAYS), 0);
    let to = localTime(addDays(today, FUTURE_DAYS), 0);
    let list = user.items
      .flatMap((item) =>
        item.airings
          .filter((airing) => airing.end > from && airing.start < to)
          .map((airing) => ({ item, airing })),
      )
      .sort((a, b) => a.airing.start - b.airing.start || a.airing.id - b.airing.id);
    // One request per window, 500 events at most: the latest ones are left
    // out, and the description says how many.
    user.truncated = Math.max(0, list.length - MAX_EVENTS);
    if (user.truncated > 0) {
      list = list.slice(0, MAX_EVENTS);
      to = list[list.length - 1].airing.start + 1;
    }

    const calendarId = this.calendarId(selector);
    await this.limit();
    await this.gladys.publishCalendars(selector, [
      {
        external_id: calendarId,
        name: pick(TEXT, language).calendar,
        description: calendarDescription(user, language),
        color: COLOR,
      },
    ]);
    // Only one calendar per user: anything else under the prefix is a leftover.
    for (const calendar of existing) {
      if (calendar.external_id !== calendarId) {
        await this.limit();
        await this.gladys.deleteCalendar(calendar.external_id);
      }
    }

    const flags = existing.find((calendar) => calendar.external_id === calendarId);
    user.shared = flags?.shared === true;
    user.sync = flags?.sync !== false;
    this.users.set(selector, user);

    // AniList could not be read (and nothing is cached): publishing the
    // window would delete the known airings. They stay until the next try.
    if (user.unavailable) {
      throw new Error('AniList unreachable');
    }
    if (!user.sync) {
      // `sync: false` is the user saying no: the core would answer 403.
      return;
    }
    const credit = pick(TEXT, language).credit;
    await this.limit();
    try {
      await this.gladys.publishCalendarEvents(
        calendarId,
        list.map(({ item, airing }) => {
          const otherTitles = Object.values(item.anime.titles).filter(
            (title, index, all) => title && title !== item.title && all.indexOf(title) === index,
          );
          return {
            external_id: this.gladys.externalId(`${selector}:airing-${airing.id}`),
            name: eventName(item, airing, language),
            start: new Date(airing.start).toISOString(),
            end: new Date(airing.end).toISOString(),
            description: truncate([...otherTitles, credit].join('\n'), 1000),
            url: item.anime.url,
          };
        }),
        { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
      );
    } catch (err) {
      // Switched off (403) or account disabled (404) since the list was
      // read: the user's notification follows.
      if (err?.status === 403 || err?.status === 404) {
        user.sync = false;
        return;
      }
      throw err;
    }
    logger.debug(`${selector}: ${user.items.length} anime, ${list.length} airing(s) published`);
    // Published from the cache: the known airings are kept, but AniList is
    // asked again soon (the retry), not in three hours.
    if (user.stale) {
      throw new Error('AniList unreachable, previous answers kept');
    }
  }

  /**
   * The anime of the shared calendars: the ones the household sees, the
   * only ones the scenes and the dashboard use (like the core's calendar
   * scenes). An anime followed by several users appears once, with their
   * names, under the title chosen by the first of them.
   * @returns {{ anime: object, title: string, airings: object[], followers: string[] }[]}
   */
  sharedAnime() {
    const byId = new Map();
    for (const user of this.users.values()) {
      if (!user.shared || !user.sync) {
        continue;
      }
      for (const { anime, title, airings } of user.items) {
        const entry = byId.get(anime.id) ?? { anime, title, airings, followers: [] };
        entry.followers.push(user.name);
        byId.set(anime.id, entry);
      }
    }
    return [...byId.values()];
  }
}

/** The next airing of an item: in the window, else the one AniList announces. */
export function nextOf(item, now) {
  const next = nextAiring(item.airings, now);
  if (next) {
    return next;
  }
  return item.anime.next && item.anime.next.end > now ? item.anime.next : null;
}
