// -----------------------------------------------------------------------------
// Quiet logs: nothing at info for a normal refresh or an air time; a failure
// repeated at every retry is logged once, and its end once.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { account, createWorld, fakeAniList } from './helpers/world.js';

/** Captures the lines of the SDK logger (console.log / console.error). */
function captureLogs(t) {
  const previous = process.env.LOG_LEVEL;
  delete process.env.LOG_LEVEL; // the default level: info
  t.after(() => {
    if (previous !== undefined) {
      process.env.LOG_LEVEL = previous;
    }
  });
  const lines = [];
  const keep = (...args) => lines.push(args.map(String).join(' '));
  t.mock.method(console, 'log', keep);
  t.mock.method(console, 'error', keep);
  t.mock.method(console, 'warn', keep);
  return {
    above: () => lines.filter((line) => !line.includes('[DEBUG]')),
    clear: () => lines.splice(0),
  };
}

test('a normal day writes nothing at info: refreshes and air times', async (t) => {
  const world = await createWorld({ accounts: [account('alice', 'demo_viewer')] });
  await world.share('alice');
  const logs = captureLogs(t);
  for (let hour = 0; hour < 48; hour += 1) {
    world.clock.now += 3_600_000;
    await world.app.refresh();
    await world.app.idle();
    await world.app.tick();
  }
  assert.ok(world.api.calls.length > 2, 'AniList read again');
  assert.deepEqual(logs.above(), []);
});

test('AniList down: one line at the first failure, one when it works again', async (t) => {
  const api = fakeAniList();
  const world = await createWorld({ accounts: [account('alice', 'demo_viewer')], api });
  const logs = captureLogs(t);
  api.fail = true;
  for (let i = 0; i < 3; i += 1) {
    world.clock.now += 7 * 3_600_000;
    await world.app.refresh();
    await world.app.idle();
  }
  // The cached answers are kept (nothing erased), the failure is said once
  // and retried, at every try.
  const errors = logs.above();
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Refresh failed: alice: AniList unreachable, previous answers kept/);
  assert.doesNotMatch(errors[0], /token|https?:/i);
  assert.equal(world.eventsOf('alice').length > 0, true);
  logs.clear();
  api.fail = false;
  // A list that just failed is not asked again for 10 minutes.
  world.clock.now += 11 * 60_000;
  await world.app.refresh();
  await world.app.idle();
  assert.equal(logs.above().length, 1);
  assert.match(logs.above()[0], /Synchronization works again/);
});
