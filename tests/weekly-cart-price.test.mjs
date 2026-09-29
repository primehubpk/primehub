import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('lib/weeklyCartPrice.ts', 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(output, { exports, require: () => ({ getPakistanDay: () => 'Monday' }) });
const { weeklyCartPrice } = exports;

test('weekly cart uses regular price when locked and live deal price on its day', () => {
  const product = { price: 2300, originalPrice: 3000 };
  const deal = { day: 'tuesday', active: true, normalPrice: 3000, dealPrice: 1999 };
  assert.equal(weeklyCartPrice(deal, product).price, 3000);
  assert.equal(weeklyCartPrice({ ...deal, day: 'monday' }, product).price, 1999);
  assert.equal(weeklyCartPrice({ ...deal, day: 'monday', active: false }, product).price, 3000);
});
