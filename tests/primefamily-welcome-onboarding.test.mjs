import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const src = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('both signup routes wait for real reseller profile before new-signup celebration', () => {
  const join=src('app/reseller/join/page.tsx');
  const account=src('app/account/page.tsx');
  for (const source of [join,account]) {
    const created=source.indexOf('await createResellerProfile(');
    const event=source.indexOf("newSignup: true");
    assert.ok(created>=0 && event>created,'Must create profile before new signup event');
  }
  assert.equal((join.match(/newSignup: true/g)||[]).length,1,
    'sign-in must not be treated as new registration');
});

test('persistent numbered code assigned by real authenticated server without client-side money creation', () => {
  const source=src('components/NativePushIdentity.tsx');
  assert.match(source,/onAuthStateChanged\(auth/);
  assert.match(source,/\/api\/reseller\/referral-code/);
  assert.match(source,/Authorization: `Bearer \$\{idToken\}`/);
  assert.match(source,/issueReferral\(user\.uid\)/);
  assert.match(source,/primehub:reseller-profile-ready/);
  assert.match(source,/newSignup === true/);
  assert.doesNotMatch(source,/walletAvailable\s*\+|walletAvailable\s*=|walletCash\s*=|walletCash\s*\+/);
  assert.match(src('lib/primeFamilyReferralsServer.ts'),/return REFERRAL_PREFIX \+ seq|const code = REFERRAL_PREFIX \+ seq/);
  assert.match(src('lib/primeFamilyReferralsServer.ts'),/tx\.create\(ownerRef/);
});

test('app welcome bonus popup never falsely reports cash without verified native credit', () => {
  const logic=src('components/NativePushIdentity.tsx');
  const popup=src('components/reseller/PrimeFamilyWelcomePopup.tsx');
  assert.match(logic,/if \(!detail\?\.success\)/);
  assert.match(logic,/credited\.add\(uid\)/);
  assert.match(popup,/reward\.credited\s*\?/);
  assert.match(popup,/Website signup par cash credit nahi hua/);
  assert.match(popup,/Reward PrimeHub shopping par use hota hai/);
  assert.match(popup,/order.*Delivered/);
  assert.match(popup,/reward\.code/);
  assert.match(logic,/primehub_welcome_popup_shown_v1/);
});

test('TypeScript JSX files transpile without diagnostics',()=>{
  for(const name of [
    'components/reseller/PrimeFamilyWelcomePopup.tsx',
    'components/NativePushIdentity.tsx',
    'app/account/page.tsx',
    'app/reseller/join/page.tsx',
  ]) {
    const r=ts.transpileModule(src(name),{
      reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},
      fileName:name,
    });
    assert.deepEqual(r.diagnostics,[],name);
  }
});
