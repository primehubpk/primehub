import test from 'node:test';
import assert from 'node:assert/strict';
import { visitorRequestAllowed, visitorTrafficSource } from '../lib/visitorPolicy.ts';
const valid = { environment: 'production', hostname: 'www.primehubmall.com', origin: 'https://www.primehubmall.com', userAgent: 'Mozilla/5.0 Android Chrome/140', engaged: true, admin: false };
test('count engaged production shoppers; exclude tests, bots, admins and cross-site submissions', () => {
  assert.equal(visitorRequestAllowed(valid), true);
  for (const patch of [{environment:'preview'}, {environment:undefined}, {engaged:false}, {admin:true}, {hostname:'localhost'}, {origin:'https://example.com'}, {origin:null}, {userAgent:'HeadlessChrome'}, {userAgent:'Googlebot'}]) {
    assert.equal(visitorRequestAllowed({...valid,...patch}), false, JSON.stringify(patch));
  }
});
test('attribute click IDs and referrals without inventing Direct origins', () => {
  const source = (search, ref = '') => visitorTrafficSource(search, ref, 'https://www.primehubmall.com');
  assert.equal(source('?ttclid=abc'), 'tiktok');
  assert.equal(source('?fbclid=abc'), 'facebook');
  assert.equal(source('?utm_source=whatsapp'), 'whatsapp');
  assert.equal(source('', 'https://www.google.com/search?q=bangles'), 'google');
  assert.equal(source('', 'https://www.primehubmall.com/shop'), 'direct');
  assert.equal(source(''), 'direct');
});
