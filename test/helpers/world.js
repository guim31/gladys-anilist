// -----------------------------------------------------------------------------
// A test world: the SDK's fake Gladys (which checks the calendar contract like
// the core: enabled users, `sync: false` → 403, window overlap, prune),
// AniList replayed from real answers recorded on 15 November 2026
// (test/fixtures), a settable clock and no timers. Times are read in
// Europe/Paris, the TZ the supervisor injects for a French instance.
//
// test/fixtures/list-demo.json is the real public list of an AniList user
// (watching and planning), renamed `demo_viewer`, plus one real anime added
// to its planning list: Sousou no Frieren 3rd Season, not aired yet and not
// dated (October 2027). test/fixtures/schedules.json holds the real airing
// schedules of that list, from two weeks back to a year ahead.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';

process.env.TZ = 'Europe/Paris';

// Sunday 15 November 2026, 10:28 in Paris, when the fixtures were recorded.
export const NOW = Date.parse('2026-11-15T09:28:00.000Z');

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));

const reply = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: new Map(),
  json: async () => structuredClone(body),
});

/**
 * AniList from the fixtures. `users` maps a lowercase user name to a
 * `MediaListCollection` (filtered by the asked statuses like AniList does)
 * or to `'private'`; any other name is unknown (404). `schedules` is
 * filtered by anime, time and page like AniList does. `fail: true` makes
 * every call throw, like a network down.
 */
export function fakeAniList({ users = {}, schedules } = {}) {
  const api = {
    calls: [],
    fail: false,
    users: { demo_viewer: fixture('list-demo'), ...users },
    schedules: schedules ?? fixture('schedules'),
    async fetch(url, init) {
      const { query, variables } = JSON.parse(init.body);
      if (api.fail) {
        api.calls.push('fail');
        throw new Error('getaddrinfo EAI_AGAIN graphql.anilist.co');
      }
      if (query.includes('MediaListCollection')) {
        api.calls.push(`list ${variables.user}`);
        const found = api.users[String(variables.user).toLowerCase()];
        if (found === 'private') {
          return reply(404, { errors: [{ message: 'Private User', status: 404 }], data: null });
        }
        if (!found) {
          return reply(404, {
            errors: [{ message: 'User not found', status: 404 }],
            data: { MediaListCollection: null },
          });
        }
        const lists = found.lists.filter((list) => variables.status.includes(list.status));
        return reply(200, { data: { MediaListCollection: { ...found, lists } } });
      }
      if (query.includes('airingSchedules')) {
        api.calls.push(`schedules ${variables.ids.join(',')} p${variables.page}`);
        const all = api.schedules.filter(
          (entry) =>
            variables.ids.includes(entry.mediaId) &&
            entry.airingAt > variables.from &&
            entry.airingAt < variables.to,
        );
        const page = all.slice((variables.page - 1) * 50, variables.page * 50);
        return reply(200, {
          data: {
            Page: {
              pageInfo: { hasNextPage: all.length > variables.page * 50 },
              airingSchedules: page,
            },
          },
        });
      }
      return reply(400, { errors: [{ message: 'Unknown query', status: 400 }], data: null });
    },
  };
  return api;
}

export function account(selector, settings = {}, language = 'fr') {
  const firstName = selector[0].toUpperCase() + selector.slice(1);
  const config = typeof settings === 'string' ? { username: settings } : settings;
  return { user: { selector, first_name: firstName, language }, config };
}

/**
 * @param {object} [options]
 * @param {object[]} [options.accounts] calendar accounts
 * @param {object} [options.config] admin config
 * @param {object[]} [options.calendars] calendars already in Gladys
 * @param {number} [options.now]
 * @param {ReturnType<typeof fakeAniList>} [options.api]
 */
export async function createWorld(options = {}) {
  const clock = { now: options.now ?? NOW };
  const api = options.api ?? fakeAniList();
  const gladys = createFakeGladys({
    config: options.config ?? {},
    calendarAccounts: options.accounts ?? [],
    calendars: options.calendars ?? [],
    logger: options.logger,
  });
  const app = registerHandlers(gladys, {
    now: () => clock.now,
    sleep: async () => {},
    fetch: api.fetch,
    timers: false,
  });
  await gladys.connect();
  await app.idle();
  return {
    gladys,
    fake: gladys.fake,
    app,
    api,
    clock,
    calendarOf(selector) {
      return gladys.fake.calendars.find((calendar) => calendar.user === selector);
    },
    eventsOf(selector) {
      const calendar = gladys.fake.calendars.find((entry) => entry.user === selector);
      return gladys.fake.calendarEvents
        .filter((event) => event.calendar_external_id === calendar?.external_id)
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    },
    /** The user shares their calendar (the toggle of "My calendars"). */
    async share(selector, shared = true) {
      const calendar = gladys.fake.calendars.find((entry) => entry.user === selector);
      calendar.shared = shared;
      await gladys.fake.calendarAccountUpdated(selector);
      await app.idle();
    },
    async editAccount(selector, config) {
      const entry = gladys.fake.calendarAccounts.find((a) => a.user.selector === selector);
      entry.config = config;
      await gladys.fake.calendarAccountUpdated(selector);
      await app.idle();
    },
  };
}
