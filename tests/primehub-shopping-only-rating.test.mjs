import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const src = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('new native welcome bonus is shopping-only and one per account/device', () => {
  const s = src('lib/playInstallBonus.ts');
  assert.match(s, /purpose: 'shopping'/);
  assert.match(s, /reseller_shopping_wallets/);
  assert.match(s, /walletShopping: shopping \+ PLAY_INSTALL_BONUS_RUPEES/);
  assert.match(s, /if \(accountClaim\.exists \|\| audit\.exists\)/);
  assert.match(s, /if \(deviceClaim\.exists\)/);
  assert.doesNotMatch(s, /purpose: 'withdrawable'/);
});

test('public withdrawal endpoint rejects all new requests even if called directly', () => {
  const s=src('app/api/reseller/withdraw/route.ts');
  assert.match(s, /status: 410/);
  assert.doesNotMatch(s, /createResellerWithdrawal\(/);
  assert.match(src('lib/resellerServer.ts'), /New withdrawal requests are disabled/);
});

test('new delivered orders and inviter credits use server-authoritative shopping balance', () => {
  assert.match(src('app/api/orders/route.ts'), /rewardSettlementMode: 'shopping_only_v1'/);
  const s=src('lib/deliveredOrderBenefits.ts');
  assert.match(s, /rewardSettlementMode === 'shopping_only_v1'/);
  assert.match(s, /tx\.set\(shoppingRef/);
  assert.match(s, /tx\.set\(referralShoppingRef/);
  assert.match(s, /priorCredit\.exists/);
  assert.match(src('lib/resellerRewardsAdmin.ts'), /tx\.set\(shoppingRef/);
});

test('pending rewards created after transition use shopping mode; legacy mode is preserved', () => {
  const s=src('lib/resellerServer.ts');
  assert.match(s, /rewardMode: 'shopping'/);
  assert.match(s, /data\.rewardMode === 'shopping'/);
  assert.match(s, /Legacy pending rewards remain in their original ledger/);
});

test('admin cannot create new withdrawable balances', () => {
  const backend=src('lib/resellerWalletCredits.ts');
  assert.match(backend, /if \(purpose !== 'shopping'\)/);
  const ui=src('components/admin/AdminResellerCreditsPanel.tsx');
  assert.doesNotMatch(ui, /setPurpose\('withdrawable'\)/);
});

test('customer wallet has no active withdrawal form; existing entitlements remain visible', () => {
  const s=src('app/reseller/wallet/page.tsx');
  assert.doesNotMatch(s, /onSubmit=\{submit\}/);
  assert.match(s, /Existing reward balance/);
  assert.match(s, /please contact PrimeHub support/);
});


test('cash-prize cards are not exposed on PrimeHub customer surfaces', () => {
  for (const file of [
    'components/home/HomeResellerUnified.tsx',
    'components/home/HomeResellerLiveRail.tsx',
    'components/reseller/PrimeFamilyDashboard.tsx',
  ]) {
    const s = src(file);
    for (const id of ['cash-500', 'challenge-cash', 'elite-cash', 'jazzcash-300', 'easypaisa-300']) {
      assert.ok(!s.includes("id: '" + id + "'") && !s.includes('id: "' + id + '"'),
        file + ': cash-convertible card remains: ' + id);
    }
  }
  assert.match(src('lib/resellerTasks.ts'), /cashReward: 0/);
  assert.doesNotMatch(src('app/admin/reseller-tasks/page.tsx'), /label="Cash option \(Rs\.\)"/);
});

test('legacy Firebase task descriptions display as shopping rewards only', () => {
  assert.match(src('lib/resellerTasks.ts'), /export function shoppingRewardDescription/);
  for (const file of [
    'components/home/HomeResellerUnified.tsx',
    'components/home/HomeResellerLiveRail.tsx',
    'components/home/HomeResellerTasksDirect.tsx',
    'components/reseller/PrimeFamilyDashboard.tsx',
  ]) assert.match(src(file), /shoppingRewardDescription\(task\.description\)/);
});
