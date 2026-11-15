// -----------------------------------------------------------------------------
// The calendars: one per enabled user, filled with the airings of the anime
// of their AniList list, from the real answers of the fixtures (two anime
// airing, finished ones, one not dated), and the AniList client itself.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOW, account, createWorld, fakeAniList, fixture } from './helpers/world.js';
import { createAniList } from '../src/anilist.js';
import { parseUserName } from '../src/config.js';

test('a user gets an "Anime" calendar with the airings of the window', async () => {
  const world = await createWorld({ accounts: [account('alice', 'demo_viewer')] });
  const calendar = world.calendarOf('alice');
  assert.equal(calendar.external_id, 'ext:test-integration:alice:anime');
  assert.equal(calendar.name, 'Animes');
  assert.equal(calendar.shared, false, 'private until the user shares it');
  const events = world.eventsOf('alice');
  // Two weeks back (from 1 November) to three months ahead (15 February):
  // The Apothecary Diaries, episodes 6 to 12, and Crayon Shin-chan weekly.
  assert.equal(events.filter((event) => event.name.startsWith('Kusuriya')).length, 7);
  assert.equal(events.filter((event) => event.name.startsWith('Crayon')).length, 15);
  assert.deepEqual(events[0], {
    calendar_external_id: calendar.external_id,
    external_id: 'ext:test-integration:alice:airing-418786',
    name: 'Kusuriya no Hitorigoto 3rd Season · Épisode 6/12',
    // Friday 23:00 in Japan: 15:00 in Paris, for the 24 minutes of an episode.
    start: '2026-11-06T14:00:00.000Z',
    end: '2026-11-06T14:24:00.000Z',
    description: 'The Apothecary Diaries Season 3\n薬屋のひとりごと 第3期\nDonnées : AniList.co',
    url: 'https://anilist.co/anime/195516',
  });
  // A long-running anime has no number of episodes.
  assert.equal(events[1].name, 'Crayon Shin-chan · Épisode 1360');
  assert.ok(events.every((event) => event.start < '2027-02-15'));
});

test('the calendar description says whose list, what airs and what has no date', async () => {
  const world = await createWorld({ accounts: [account('alice', 'demo_viewer', 'en')] });
  const { description, name } = world.calendarOf('alice');
  assert.equal(name, 'Anime', 'the language of the user');
  assert.equal(
    description,
    [
      'AniList list of demo_viewer: 12 anime followed.',
      'Airing: Crayon Shin-chan, Kusuriya no Hitorigoto 3rd Season.',
      'No date yet: Sousou no Frieren 3rd Season (2027-10).',
      'Data: AniList.co',
    ].join('\n'),
  );
});

test('titles follow the language each user chose, with a fallback', async () => {
  const world = await createWorld({
    accounts: [
      account('alice', { username: 'demo_viewer', title_language: 'english' }, 'en'),
      account('bob', { username: 'demo_viewer', title_language: 'native' }),
    ],
  });
  const [first] = world.eventsOf('alice');
  assert.equal(first.name, 'The Apothecary Diaries Season 3 · Episode 6/12');
  assert.match(first.description, /^Kusuriya no Hitorigoto 3rd Season\n/);
  assert.equal(world.eventsOf('bob')[0].name, '薬屋のひとりごと 第3期 · Épisode 6/12');
  // Frieren 3rd Season has no English title: the romaji one stands in.
  assert.match(world.calendarOf('alice').description, /No date yet: Sousou no Frieren 3rd Season/);
});

test('only the anime that may air cost a request, and a list is read once', async () => {
  const world = await createWorld({
    accounts: [
      account('alice', 'demo_viewer'),
      account('bob', 'https://anilist.co/user/demo_viewer/'),
    ],
  });
  // The finished anime of the list (9 of 12) are not asked for.
  assert.deepEqual(world.api.calls, ['list demo_viewer', 'schedules 966,195516,209939 p1']);
  assert.equal(world.eventsOf('bob').length, 22);
});

test('"watching" only: the planning list is left out', async () => {
  const world = await createWorld({
    accounts: [account('alice', { username: 'demo_viewer', statuses: 'current' }, 'en')],
  });
  assert.deepEqual(world.api.calls, ['list demo_viewer', 'schedules 966 p1']);
  assert.match(world.calendarOf('alice').description, /: 5 anime followed\.\nAiring: Crayon/);
  assert.ok(world.eventsOf('alice').every((event) => event.name.startsWith('Crayon')));
});

test('an unknown user, a private list, an empty one, no name: said, and no event', async () => {
  const empty = { user: { id: 2, name: 'empty_list' }, lists: [] };
  const api = fakeAniList({ users: { empty_list: empty, hidden_list: 'private' } });
  const world = await createWorld({
    api,
    accounts: [
      account('alice', 'nobody_zzqx', 'en'),
      account('bob', 'hidden_list', 'en'),
      account('carol', 'empty_list', 'en'),
      account('dave', {}, 'en'),
    ],
  });
  assert.match(world.calendarOf('alice').description, /^No AniList user named "nobody_zzqx"/);
  assert.match(world.calendarOf('bob').description, /^The list of "hidden_list" is private/);
  assert.match(world.calendarOf('carol').description, /^AniList list of empty_list: 0 anime/);
  assert.match(world.calendarOf('dave').description, /^No AniList user name yet/);
  for (const user of ['alice', 'bob', 'carol', 'dave']) {
    assert.deepEqual(world.eventsOf(user), []);
  }
  assert.ok(!api.calls.includes('list '), 'no request without a name');
  // A wrong name is an answer, not a failure: nothing to retry.
  assert.equal(world.app.syncer.ready, true);
});

test('a name corrected in the account replaces the airings', async () => {
  const world = await createWorld({ accounts: [account('alice', 'demo_viewer')] });
  assert.equal(world.eventsOf('alice').length, 22);
  await world.editAccount('alice', { username: 'nobody_zzqx' });
  assert.deepEqual(world.eventsOf('alice'), []);
  assert.match(world.calendarOf('alice').description, /Aucun utilisateur AniList « nobody_zzqx »/);
});

test('AniList down: the known airings stay, and the next refresh fills them', async () => {
  const api = fakeAniList();
  api.fail = true;
  const world = await createWorld({ api, accounts: [account('alice', 'demo_viewer', 'en')] });
  assert.match(world.calendarOf('alice').description, /^AniList unreachable/);
  assert.deepEqual(world.eventsOf('alice'), []);
  api.fail = false;
  world.clock.now += 11 * 60_000;
  await world.app.refresh();
  await world.app.idle();
  assert.equal(world.eventsOf('alice').length, 22);
  // Down again later: the cache serves, nothing is erased.
  api.fail = true;
  world.clock.now += 4 * 3_600_000;
  await world.app.refresh();
  await world.app.idle();
  assert.equal(world.eventsOf('alice').length, 22);
});

test('the window slides: the airings of the new days come in', async () => {
  const world = await createWorld({ accounts: [account('alice', 'demo_viewer')] });
  const before = world.eventsOf('alice').filter((event) => event.name.startsWith('Crayon'));
  assert.equal(before.at(-1).start, '2027-02-13T07:30:00.000Z');
  world.clock.now = NOW + 7 * 86_400_000;
  await world.app.refresh();
  await world.app.idle();
  const after = world.eventsOf('alice').filter((event) => event.name.startsWith('Crayon'));
  assert.equal(after.at(-1).start, '2027-02-20T07:30:00.000Z');
});

test('a user name is read from the name, @name or the profile address', () => {
  assert.equal(parseUserName(' demo_viewer '), 'demo_viewer');
  assert.equal(parseUserName('@demo_viewer'), 'demo_viewer');
  assert.equal(parseUserName('https://anilist.co/user/demo_viewer/animelist'), 'demo_viewer');
  assert.equal(parseUserName(''), '');
});

test('the client: a 429 waits Retry-After, pages are followed, errors are typed', async () => {
  const waits = [];
  let calls = 0;
  const schedules = fixture('schedules');
  const client = createAniList({
    now: () => 0,
    sleep: async (ms) => {
      waits.push(ms);
    },
    fetch: async (url, init) => {
      calls += 1;
      if (calls === 1) {
        return {
          status: 429,
          ok: false,
          headers: new Map([['retry-after', '7']]),
          json: async () => ({}),
        };
      }
      const { variables } = JSON.parse(init.body);
      const page = schedules.slice((variables.page - 1) * 50, variables.page * 50);
      return {
        status: 200,
        ok: true,
        headers: new Map(),
        json: async () => ({
          data: {
            Page: {
              pageInfo: { hasNextPage: variables.page * 50 < schedules.length },
              airingSchedules: page,
            },
          },
        }),
      };
    },
  });
  const all = await client.schedules([966, 195516], 0, 2e12);
  assert.equal(all.length, schedules.length);
  assert.equal(all.length > 50, true, 'two pages');
  assert.ok(waits.includes(7000));

  const failing = (body, status = 404) =>
    createAniList({
      sleep: async () => {},
      fetch: async () => ({ status, ok: false, headers: new Map(), json: async () => body }),
    });
  await assert.rejects(
    failing({ errors: [{ message: 'User not found', status: 404 }] }).list('x', ['CURRENT']),
    { reason: 'not_found' },
  );
  await assert.rejects(
    failing({ errors: [{ message: 'Private User', status: 404 }] }).list('x', ['CURRENT']),
    { reason: 'private' },
  );
  await assert.rejects(failing(null, 503).list('x', ['CURRENT']), (err) => {
    assert.equal(err.reason, undefined);
    assert.match(err.message, /HTTP 503/);
    return true;
  });
});
