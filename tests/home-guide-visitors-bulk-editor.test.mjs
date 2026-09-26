import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

test('homepage guide preview autoplays muted and can unmute on tap', () => {
  const source = read('components/home/HomeGuideVideo.tsx');

  assert.match(source, /const \[introSoundOn, setIntroSoundOn\] = useState\(false\)/);
  assert.match(source, /function|const enableIntroSound/);
  assert.match(source, /command\("unMute"\)/);
  assert.match(source, /command\("setVolume", \[100\]\)/);
  assert.match(source, /mute=\$\{introSoundOn \? 0 : 1\}/);
  assert.match(source, /Tap for sound/);
});

test('visitor count remains one browser device per Pakistan day', () => {
  const tracker = read('components/VisitorTracker.tsx');
  const route = read('app/api/visit/route.ts');
  const migration = read('supabase/migrations/20260924_daily_unique_visitors.sql');

  assert.match(tracker, /primehub-device-id-v1/);
  assert.match(tracker, /primehub-counted-day-v1/);
  assert.match(route, /on_conflict: "visit_day,device_hash"/);
  assert.match(route, /resolution=ignore-duplicates/);
  assert.match(migration, /primary key \(visit_day, device_hash\)/);
});

test('visitor details load only on admin click and can expose linked member info', () => {
  const api = read('app/api/admin/visitors/route.ts');
  const ui = read('components/admin/VisitorStats.tsx');

  assert.match(api, /details.*today.*yesterday/s);
  assert.match(api, /device_hash,source,country,first_seen_at,member_uid,member_email,member_name/);
  assert.match(api, /Visitor detail read failed/);
  assert.match(ui, /Tap to view IDs/);
  assert.match(ui, /Member:/);
  assert.match(ui, /UID:/);
});

test('bulk product editor supports a custom size fit or pack value', () => {
  const source = read('components/admin/BulkProductEditor.tsx');

  assert.match(source, /const \[customSizeValue, setCustomSizeValue\] = useState\(''\)/);
  assert.match(source, /function addCustomSize\(\)/);
  assert.match(source, /placeholder="Custom size \/ fit \/ pack"/);
  assert.match(source, /\+ Add custom/);
  assert.match(source, /addSizePreset\(\{/);
});

test('active local-test branch remains disabled for Vercel auto deploy', () => {
  const vercel = JSON.parse(read('vercel.json'));
  assert.equal(
    vercel.git?.deploymentEnabled?.['fix/category-continuous-sections'],
    false,
  );
});


test('local development unregisters the PWA worker and clears PrimeHub caches', () => {
  const register = read('components/PWARegister.tsx');
  const sw = read('public/sw.js');

  assert.match(register, /process\.env\.NODE_ENV !== 'production'/);
  assert.match(register, /window\.location\.hostname === 'localhost'/);
  assert.match(register, /navigator\.serviceWorker\.getRegistrations\(\)/);
  assert.match(register, /registration\.unregister\(\)/);
  assert.match(register, /name\.startsWith\('primehub-pwa-'\)/);
  assert.match(sw, /const VERSION = 'primehub-pwa-v3'/);
});
