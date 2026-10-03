import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('Home return reserves page height, restores saved position including zero and cancels delayed top jumps', () => {
  let effect, cleanup, y = 1200, state = false;
  const events = new Map(), timers = new Map();
  let timerId = 0;
  const makeLive = () => ({
    offsetHeight: 3000, style: {}, dataset: {}, inert: false,
    querySelectorAll: () => [], removeAttribute() {}, setAttribute() {},
    addEventListener() {}, removeEventListener() {}, remove() { this.removed = true; },
    cloneNode() { return makeLive(); },
  });
  let live = makeLive();
  const frame = { style: {}, querySelector: () => live, appendChild(node) { this.cover = node; } };
  const window = {
    get scrollY() { return y; }, innerHeight: 700,
    scrollTo({top}) { y = top; },
    addEventListener(type, listener) { events.set(type, listener); },
    removeEventListener(type) { events.delete(type); },
    dispatchEvent(event) { events.get(event.type)?.(event); },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  const context = vm.createContext({ window, sessionStorage: {setItem() {}}, Event,
    document: {addEventListener() {}, removeEventListener() {}},
    ResizeObserver: class {observe() {} disconnect() {}},
    exports: {}, require: () => ({
      useRef: () => ({current:frame}), useState: () => [state, next => {state=next;}],
      useLayoutEffect: fn => {effect=fn;},
    }),
  });
  vm.runInContext(ts.transpileModule(fs.readFileSync('lib/homeKeep.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, context);
  context.exports.useKeptHomeCover(); cleanup=effect(); cleanup();
  // A short loading layout must not clamp a restored position to its footer.
  live=makeLive(); live.offsetHeight=400; y=0;
  context.exports.useKeptHomeCover(); cleanup=effect();
  assert.equal(y,1200); assert.equal(frame.style.minHeight,'3000px'); assert.equal(state,true);
  context.exports.scrollHomeToTop();
  assert.equal(y,0); assert.equal(state,false); assert.equal(frame.style.minHeight,'');
  for(const fn of timers.values())fn();
  assert.equal(y,0,'a second Home tap must not be undone by a delayed restore');
  cleanup();
  live=makeLive(); y=800;
  context.exports.useKeptHomeCover(); cleanup=effect();
  assert.equal(y,0,'saved position zero is restored, not treated as missing');
  cleanup();
});
