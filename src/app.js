// -----------------------------------------------------------------------------
// Wiring between the Gladys SDK and the anime: the handlers, the refresh of
// AniList every few hours, the daily slide of the window and the watcher of
// the air days. Takes the SDK client as a parameter so the tests drive it
// with the SDK's fake Gladys and a replayed AniList.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { createAniList } from './anilist.js';
import { Catalog, REFRESH_MS } from './catalog.js';
import { normalizeConfig } from './config.js';
import { TEXT, allLanguages, pick } from './i18n.js';
import { AirWatcher, SCENE_ACTIONS, announcedEvent } from './scenes.js';
import { Syncer, createLimiter, describe, nextOf } from './syncer.js';
import { addDays, localDate, localTime } from './time.js';
import { ANIME_WIDGET, animeContent } from './widgets.js';

const logger = createLogger({ name: 'app' });

export const CHECK_ACTION = 'check';
// The watcher looks every 30 s: a scene fires within half a minute.
export const TICK_MS = 30_000;
// The window slides once a day, a few minutes after local midnight.
const DAILY_AT_MINUTES = 5;
// A failed synchronization (AniList or the core unreachable, a 429) is
// retried after a minute, then twice as late each time, up to an hour.
const RETRY_MIN_MS = 60_000;
const RETRY_MAX_MS = 60 * 60_000;

/**
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {object} [deps] test seams
 * @param {() => number} [deps.now]
 * @param {boolean} [deps.timers] false: no timers (tests drive `tick()` and `refresh()`)
 * @param {(ms: number) => Promise<void>} [deps.sleep] for the limiters
 * @param {Function} [deps.fetch] for the AniList client
 */
export function registerHandlers(gladys, deps = {}) {
  const now = deps.now ?? Date.now;
  const useTimers = deps.timers !== false;
  let config = normalizeConfig();
  let tickTimer = null;
  let dailyTimer = null;
  let refreshTimer = null;
  let stopped = false;
  let pending = Promise.resolve();
  let failing = false;
  let retryTimer = null;
  let retryMs = RETRY_MIN_MS;

  const client = createAniList({ fetch: deps.fetch, sleep: deps.sleep, now });
  const catalog = new Catalog({ client, now });
  const syncer = new Syncer({
    gladys,
    catalog,
    getConfig: () => config,
    now,
    limit: createLimiter({ now, sleep: deps.sleep }),
  });
  const watcher = new AirWatcher();

  const refreshWidget = () => gladys.requestWidgetRefresh(ANIME_WIDGET);

  async function publishAnnouncements() {
    const shared = new Map(syncer.sharedAnime().map((entry) => [entry.anime.id, entry]));
    for (const anime of catalog.takeAnnounced()) {
      const entry = shared.get(anime.id);
      if (!entry) {
        continue;
      }
      const event = announcedEvent({ ...entry, anime }, config.language, now());
      try {
        await gladys.publishSceneEvent(event.key, event.data);
        logger.info(`New episode announced for ${entry.title}`);
      } catch (err) {
        logger.warn(`Scene trigger ${event.key} not sent: ${describe(err)}`);
      }
    }
  }

  // A synchronization failing again and again: one line, not one per try.
  // Only a full synchronization ends a failure: one user's success says
  // nothing of the others, whose retry stays scheduled.
  async function run(label, fn, { full = true } = {}) {
    try {
      const result = await fn();
      if (full) {
        if (failing) {
          failing = false;
          logger.info('Synchronization works again');
        }
        clearTimeout(retryTimer);
        retryTimer = null;
        retryMs = RETRY_MIN_MS;
      }
      return result;
    } catch (err) {
      if (!failing) {
        failing = true;
        logger.error(`${label} failed: ${describe(err)}`);
      } else {
        logger.debug(`${label} failed again: ${describe(err)}`);
      }
      scheduleRetry();
      return undefined;
    } finally {
      await publishAnnouncements();
      refreshWidget();
    }
  }

  // Every user is re-read on a retry: whatever failed is redone.
  function scheduleRetry() {
    if (!useTimers || stopped || retryTimer) {
      return;
    }
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      if (gladys.connected !== false) {
        await run('Synchronization', () => syncer.syncAll());
      }
    }, retryMs);
    retryTimer.unref?.();
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
  }

  async function tick() {
    if (!syncer.ready) {
      return 0;
    }
    const events = watcher.look(syncer.sharedAnime(), config.language, now());
    for (const event of events) {
      try {
        await gladys.publishSceneEvent(event.key, event.data);
      } catch (err) {
        logger.warn(`Scene trigger ${event.key} not sent: ${describe(err)}`);
      }
    }
    if (events.length > 0) {
      logger.debug(`${events.length} air time(s) sent to the scenes`);
    }
    return events.length;
  }

  function scheduleDaily() {
    clearTimeout(dailyTimer);
    if (!useTimers || stopped) {
      return;
    }
    const next = localTime(addDays(localDate(now()), 1), DAILY_AT_MINUTES);
    dailyTimer = setTimeout(
      async () => {
        if (gladys.connected !== false) {
          await run('Daily slide', () => syncer.syncAll());
        }
        scheduleDaily();
      },
      Math.max(60_000, next - now()),
    );
    dailyTimer.unref?.();
  }

  function startTimers() {
    clearInterval(tickTimer);
    clearInterval(refreshTimer);
    if (!useTimers || stopped) {
      return;
    }
    tickTimer = setInterval(() => {
      tick().catch((err) => logger.warn(`Air time check failed: ${describe(err)}`));
    }, TICK_MS);
    tickTimer.unref?.();
    // The catalog reads again the lists and airings older than REFRESH_MS.
    refreshTimer = setInterval(() => {
      pending = run('Refresh', () => syncer.syncAll());
    }, REFRESH_MS);
    refreshTimer.unref?.();
  }

  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
    } catch (err) {
      logger.error(`Could not read the configuration: ${describe(err)}`);
    }
    // The resync contract of the calendar type: an account enabled or a
    // calendar switched back on while disconnected is only known by
    // re-reading everything.
    pending = run('Synchronization', () => syncer.syncAll()).then(() => tick());
    scheduleDaily();
    startTimers();
  });

  gladys.on('disconnected', () => {
    clearTimeout(retryTimer);
    retryTimer = null;
    clearTimeout(dailyTimer);
    clearInterval(tickTimer);
    clearInterval(refreshTimer);
  });

  gladys.onConfigUpdated(async (newConfig) => {
    config = normalizeConfig(newConfig);
    logger.info('Configuration updated');
  });

  gladys.onCalendarAccountUpdated(async (userSelector) => {
    logger.info(`AniList account of ${userSelector} updated`);
    pending = run('Synchronization', () => syncer.syncUser(userSelector), { full: false }).then(
      () => tick(),
    );
  });

  gladys.onAction(CHECK_ACTION, async () => {
    logger.info('Action "check": reading AniList again');
    try {
      await syncer.syncAll({ force: true });
    } catch (err) {
      logger.warn(`Check failed: ${describe(err)}`);
      return allLanguages((language) => pick(TEXT, language).checkFailed);
    } finally {
      await publishAnnouncements();
      refreshWidget();
    }
    // Every anime of the lists read (a list shared by two users counts once),
    // and the ones with a next episode dated.
    const lists = new Map();
    const items = new Map();
    for (const user of syncer.users.values()) {
      if (user.username && !user.error) {
        lists.set(`${user.username.toLowerCase()}|${user.statuses}`, user.total);
      }
      for (const item of user.items) {
        items.set(item.anime.id, item);
      }
    }
    const total = [...lists.values()].reduce((sum, count) => sum + count, 0);
    const dated = [...items.values()].filter((item) => nextOf(item, now())).length;
    return allLanguages((language) => pick(TEXT, language).check(total, dated));
  });

  gladys.onSceneAction('next_episode', (fields) =>
    SCENE_ACTIONS.next_episode({ syncer, config, now: now() }, fields),
  );

  gladys.onWidgetGet(ANIME_WIDGET, async ({ settings, language }) =>
    animeContent(syncer, { settings, language, now: now() }),
  );

  return {
    syncer,
    catalog,
    tick,
    /** A refresh, as the timer does it (tests). */
    refresh: () => (pending = run('Refresh', () => syncer.syncAll())),
    /** Resolves once the synchronization in progress is over (tests). */
    idle: async () => {
      await pending;
      await syncer.running;
    },
    async stop() {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(dailyTimer);
      clearInterval(tickTimer);
      clearInterval(refreshTimer);
    },
  };
}
