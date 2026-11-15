// -----------------------------------------------------------------------------
// Scene triggers, the scene action and the widget, on the shared calendars
// only, from the real AniList answers of the fixtures.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import assert from 'node:assert/strict';
import { NOW, account, createWorld, fakeAniList, fixture } from './helpers/world.js';

const TODAY = 'episode_today';
const ANNOUNCED = 'episode_announced';

async function sharedWorld(options = {}) {
  const world = await createWorld({ accounts: [account('alice', 'demo_viewer')], ...options });
  await world.share('alice');
  return world;
}

/** The demo list where an anime of the planning list is given a next airing. */
function listWith(id, nextAiringEpisode) {
  const list = fixture('list-demo');
  for (const { entries } of list.lists) {
    for (const entry of entries) {
      if (entry.media.id === id) {
        entry.media.nextAiringEpisode = nextAiringEpisode;
      }
    }
  }
  return list;
}

test('"episode today" fires at the air time and in the morning, once each', async () => {
  const world = await sharedWorld();
  // Saturday 21 November: Crayon Shin-chan airs at 08:30 in Paris.
  world.clock.now = Date.parse('2026-11-21T07:30:20Z');
  assert.equal(await world.app.tick(), 1);
  world.clock.now = Date.parse('2026-11-21T08:00:20Z');
  assert.equal(await world.app.tick(), 1);
  assert.equal(await world.app.tick(), 0, 'once');
  const events = world.fake.sceneEvents.filter((event) => event.key === TODAY);
  assert.deepEqual(
    events.map((event) => event.data.moment),
    ['air_time', 'morning'],
  );
  assert.deepEqual(events[0].data, {
    anime: 'Crayon Shin-chan',
    episode: 1362,
    episodes: 0,
    date: 'sam. 21 nov., 08:30',
    time: '08:30',
    url: 'https://anilist.co/anime/966',
    moment: 'air_time',
    users: 'Alice',
  });
});

test('a restart after the moment fires nothing, a private calendar neither', async () => {
  const late = await sharedWorld({ now: Date.parse('2026-11-21T09:00:00Z') });
  assert.equal(await late.app.tick(), 0);
  const world = await createWorld({ accounts: [account('alice', 'demo_viewer')] });
  world.clock.now = Date.parse('2026-11-21T07:30:20Z');
  assert.equal(await world.app.tick(), 0, 'not shared');
});

test('"new episode announced" fires when an anime without a date gets one', async () => {
  const api = fakeAniList();
  const world = await sharedWorld({ api });
  assert.deepEqual(world.fake.sceneEvents, [], 'nothing at the first reading');
  // Frieren 3rd Season gets its first date: 2 October 2027, 23:00 in Japan.
  const airingAt = Date.parse('2027-10-02T14:00:00Z') / 1000;
  api.users.demo_viewer = listWith(209939, { id: 900001, airingAt, episode: 1 });
  world.clock.now = NOW + 3 * 3_600_000;
  await world.app.refresh();
  await world.app.idle();
  const events = world.fake.sceneEvents.filter((event) => event.key === ANNOUNCED);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].data, {
    anime: 'Sousou no Frieren 3rd Season',
    episode: 1,
    episodes: 0,
    date: 'sam. 2 oct., 16:00',
    time: '16:00',
    url: 'https://anilist.co/anime/209939',
    days_left: 321,
    users: 'Alice',
  });
  // The same date read again: no new announcement.
  world.clock.now += 3 * 3_600_000;
  await world.app.refresh();
  await world.app.idle();
  assert.equal(world.fake.sceneEvents.filter((event) => event.key === ANNOUNCED).length, 1);
});

test('an anime dated one week at a time is not announced at every episode', async () => {
  const api = fakeAniList();
  const world = await sharedWorld({ api });
  // 21 November: episode 8 of The Apothecary Diaries aired yesterday, AniList
  // dates episode 9 a week later.
  const ninth = fixture('schedules').find(
    (entry) => entry.mediaId === 195516 && entry.episode === 9,
  );
  api.users.demo_viewer = listWith(195516, { id: ninth.id, airingAt: ninth.airingAt, episode: 9 });
  world.clock.now = Date.parse('2026-11-21T10:00:00Z');
  await world.app.refresh();
  await world.app.idle();
  assert.deepEqual(
    world.fake.sceneEvents.filter((event) => event.key === ANNOUNCED),
    [],
  );
});

test('"next episode": an anime by any of its titles, or the soonest of all', async () => {
  const world = await sharedWorld();
  const soonest = await world.fake.sceneAction('next_episode', {});
  assert.deepEqual(soonest.data.outputs, {
    found: 1,
    anime: 'Kusuriya no Hitorigoto 3rd Season',
    episode: 8,
    episodes: 12,
    date: 'ven. 20 nov., 15:00',
    time: '15:00',
    days_left: 5,
    status: 'Prochain épisode daté',
    last_episode: 7,
  });
  const english = await world.fake.sceneAction('next_episode', {
    anime: 'the apothecary diaries season 3',
  });
  assert.equal(english.data.outputs.anime, 'Kusuriya no Hitorigoto 3rd Season');
  const undated = await world.fake.sceneAction('next_episode', { anime: 'Sousou no Frieren' });
  assert.equal(undated.data.outputs.found, 1);
  assert.equal(undated.data.outputs.days_left, -1);
  assert.equal(undated.data.outputs.status, 'Pas encore diffusé, sans date');
  const unknown = await world.fake.sceneAction('next_episode', { anime: 'One Piece' });
  assert.equal(unknown.data.outputs.found, 0);
});

test('the widget lists the coming episodes and where each anime stands', async () => {
  const world = await sharedWorld();
  const ack = await world.fake.widgetGet('upcoming_episodes', {
    settings: { days: '7' },
    language: 'en',
    units: 'metric',
  });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
  const [list, status] = ack.data.content.components;
  assert.deepEqual(
    list.items.map((item) => [item.title, item.subtitle]),
    [
      ['Kusuriya no Hitorigoto 3rd Season', 'Episode 8/12 · Fri 20 Nov, 15:00'],
      ['Crayon Shin-chan', 'Episode 1362 · Sat 21 Nov, 08:30'],
    ],
  );
  // The finished anime of the list have no row.
  assert.deepEqual(
    status.items.map((item) => [item.label, item.value]),
    [
      ['Kusuriya no Hitorigoto 3rd Season', 'In 5 days'],
      ['Crayon Shin-chan', 'In 6 days'],
      ['Sousou no Frieren 3rd Season', 'Not aired yet, no date'],
    ],
  );
  const filtered = await world.fake.widgetGet('upcoming_episodes', {
    settings: { anime: 'Crayon Shin-chan', show_status: false },
    language: 'en',
    units: 'metric',
  });
  assert.equal(filtered.data.content.components.length, 1);
  assert.equal(filtered.data.content.components[0].items.length, 2);
});

test('the widget says when nothing is shared', async () => {
  const world = await createWorld({ accounts: [account('alice', 'demo_viewer')] });
  const ack = await world.fake.widgetGet('upcoming_episodes', {
    settings: {},
    language: 'fr',
    units: 'metric',
  });
  assert.match(ack.data.content.components[0].text, /Aucun calendrier d'animes partagé/);
});
