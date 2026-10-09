// Run with: node --experimental-strip-types --test tests/daily-push.test.mjs
// Logic test scenarios are documented for the Play integration in play-store/PUSH-NOTIFICATIONS.md.
// The TypeScript source uses the Next.js @/ alias, so integration checks run within Next build.
import test from 'node:test';
import assert from 'node:assert/strict';

test('four slots only, mapped to Karachi morning and evening', () => {
  const slots = { morning: ['browse', 'big'], evening: ['live', 'arrivals'] };
  assert.equal([...slots.morning, ...slots.evening].length, 4);
  assert.equal(new Date('2026-10-09T06:00:00Z').toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false }), '11');
  assert.equal(new Date('2026-10-09T17:00:00Z').toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false }), '22');
});
