// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LIST_STATUSES } from '../src/anilist.js';
import { TITLE_LANGUAGES } from '../src/anime.js';
import { DEFAULT_ACCOUNT, DEFAULT_CONFIG, LANGUAGES } from '../src/config.js';
import { CHECK_ACTION } from '../src/app.js';
import { MOMENTS, SCENE_ACTIONS, SCENE_TRIGGER_KEYS } from '../src/scenes.js';
import { ANIME_WIDGET, WIDGET_DAYS } from '../src/widgets.js';
import { account, createWorld } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const optionsOf = (field) => field.options.map((option) => option.value);
const field = (list, key) => list.find((entry) => entry.key === key);

test('a cloud calendar integration, for Gladys 5.2.0 and later', () => {
  // `type: "calendar"` and `account_schema` came with 5.2.0.
  assert.equal(manifest.type, 'calendar');
  assert.equal(manifest.gladys_version, '>=5.2.0');
  assert.deepEqual(manifest.categories, ['multimedia']);
  // Everything comes from graphql.anilist.co.
  assert.deepEqual(manifest.transports, ['cloud']);
});

test('account_schema defaults and choices are the ones of the code', () => {
  const [intro, ...settings] = manifest.account_schema;
  assert.equal(intro.type, 'section');
  assert.deepEqual(keysOf(settings), Object.keys(DEFAULT_ACCOUNT));
  for (const entry of settings) {
    assert.equal(entry.required, false, `${entry.key} is optional`);
    assert.equal(DEFAULT_ACCOUNT[entry.key], entry.default, `default of ${entry.key}`);
  }
  assert.equal(field(settings, 'username').type, 'string');
  assert.deepEqual(optionsOf(field(settings, 'statuses')), Object.keys(LIST_STATUSES));
  assert.deepEqual(optionsOf(field(settings, 'title_language')), TITLE_LANGUAGES);
});

test('config_schema defaults and choices are the ones of the code', () => {
  const settings = manifest.config_schema.filter((item) => item.type !== 'section');
  for (const entry of settings) {
    assert.equal(DEFAULT_CONFIG[entry.key], entry.default, `default of ${entry.key}`);
  }
  assert.deepEqual(Object.keys(DEFAULT_CONFIG).sort(), keysOf(settings).sort());
  assert.deepEqual(optionsOf(field(manifest.config_schema, 'language')), LANGUAGES);
});

test('every declared action, scene action and widget has a handler', async () => {
  const world = await createWorld({ accounts: [account('alice', 'demo_viewer')] });
  await world.share('alice');
  assert.deepEqual(keysOf(manifest.actions), [CHECK_ACTION]);
  for (const key of keysOf(manifest.actions)) {
    const ack = await world.fake.action(key, {});
    assert.equal(ack.success, true, `${key}: ${ack.error}`);
    assert.deepEqual(Object.keys(ack.data.message), LANGUAGES);
  }
  assert.deepEqual(keysOf(manifest.scene_actions), Object.keys(SCENE_ACTIONS));
  for (const key of keysOf(manifest.scene_actions)) {
    for (const fields of [{}, { anime: 'frieren' }, { anime: 'nothing like it' }]) {
      const ack = await world.fake.sceneAction(key, fields);
      assert.equal(ack.success, true, `${key}: ${ack.error}`);
      assert.deepEqual(
        Object.keys(ack.data.outputs),
        keysOf(field(manifest.scene_actions, key).outputs),
      );
    }
  }
  assert.deepEqual(keysOf(manifest.widgets), [ANIME_WIDGET]);
  const ack = await world.fake.widgetGet(ANIME_WIDGET, {
    settings: {},
    language: 'en',
    units: 'metric',
  });
  assert.equal(ack.success, true);
});

test('the scene triggers fired by the code are the declared ones, with their filters', async () => {
  assert.deepEqual(keysOf(manifest.scene_triggers), SCENE_TRIGGER_KEYS);
  const today = field(manifest.scene_triggers, 'episode_today');
  assert.deepEqual(keysOf(today.fields), ['anime', 'moment']);
  const moment = field(today.fields, 'moment');
  assert.deepEqual(optionsOf(moment), MOMENTS);
  // Empty, it would match both moments: the scene would run twice a day.
  assert.equal(moment.required, true);

  // Every key the code sends is a declared field or variable.
  const world = await createWorld({ accounts: [account('alice', 'demo_viewer')] });
  await world.share('alice');
  // Saturday 21 November, 09:00 in Paris: Crayon Shin-chan airs at 08:30.
  world.clock.now = Date.parse('2026-11-21T08:00:10Z');
  await world.app.tick();
  const [event] = world.fake.sceneEvents;
  const declared = [...keysOf(today.fields), ...keysOf(today.variables)];
  assert.deepEqual(
    Object.keys(event.data).filter((key) => !declared.includes(key)),
    [],
  );
  assert.deepEqual(
    keysOf(today.variables).filter((key) => !(key in event.data)),
    [],
  );
  const announced = field(manifest.scene_triggers, 'episode_announced');
  assert.deepEqual(keysOf(announced.fields), ['anime']);
  assert.ok(keysOf(announced.variables).includes('days_left'));
});

test('the widget settings are the ones the code reads', () => {
  const [widget] = manifest.widgets;
  assert.deepEqual(keysOf(widget.settings), ['anime', 'days', 'show_status']);
  assert.deepEqual(optionsOf(field(widget.settings, 'days')), WIDGET_DAYS);
  assert.equal(field(widget.settings, 'show_status').default, true);
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  // The Release workflow writes all three: a mismatch means one was edited by
  // hand, and Gladys would offer a version whose image is another one.
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.equal(manifest.docker_image, `ghcr.io/guim31/gladys-anilist:${manifest.version}`);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-anilist/main/cover.png',
  );
});

test('section fields are purely presentational', () => {
  for (const section of [...manifest.config_schema, ...manifest.account_schema].filter(
    (entry) => entry.type === 'section',
  )) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.equal(section.placeholder, undefined);
  }
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [language, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `${language}: ${text.length}`);
  }
});
