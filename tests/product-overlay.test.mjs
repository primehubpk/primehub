import assert from 'node:assert/strict';
import test from 'node:test';
import { productBackAction, productTargetFromHref } from '../lib/productOverlay.ts';

test('product links keep the id and big-deal flag without leaving the site', () => {
  assert.deepEqual(
    productTargetFromHref('/product/bangle%201?deal=big', 'https://primehubmall.com'),
    { id: 'bangle 1', href: '/product/bangle%201?deal=big', bigDeal: true },
  );
  assert.equal(productTargetFromHref('/shop', 'https://primehubmall.com'), null);
  assert.equal(productTargetFromHref('https://example.com/product/secret', 'https://primehubmall.com'), null);
  assert.equal(productTargetFromHref('/product/', 'https://primehubmall.com'), null);
});

test('back returns through the open product, then history, otherwise home', () => {
  assert.equal(productBackAction({
    overlayOpen: true,
    referrer: '',
    historyLength: 1,
    origin: 'https://primehubmall.com',
  }), 'overlay-back');
  assert.equal(productBackAction({
    overlayOpen: false,
    referrer: 'https://primehubmall.com/shop',
    historyLength: 2,
    origin: 'https://primehubmall.com',
  }), 'history-back');
  assert.equal(productBackAction({
    overlayOpen: false,
    referrer: 'https://google.com',
    historyLength: 2,
    origin: 'https://primehubmall.com',
  }), 'home');
  assert.equal(productBackAction({
    overlayOpen: false,
    referrer: 'https://primehubmall.com/',
    historyLength: 1,
    origin: 'https://primehubmall.com',
  }), 'home');
});
