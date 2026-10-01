const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');

// Exercise the actual event handlers with a small hook host. No credentials,
// real uploads, or TikTok posts are used by these regression tests.
async function host() {
  const state = [], effects = [];
  let cursor = 0, mounted = false;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    },
    useEffect(effect) { if (!mounted) effects.push(effect); },
  };
  const source = fs.readFileSync('components/admin/TikTokPostingManager.tsx', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  const fetchMock = async (url) => ({ ok: true, json: async () =>
    url.endsWith('/pin') ? { configured: true, authorized: true } :
    url.endsWith('/video') ? { url: 'https://images.primehubmall.com/tiktok-sandbox/test.mp4' } :
    { connected: true, creator: { max_video_post_duration_sec: 60, privacy_level_options: ['SELF_ONLY'] } },
  });
  new Function('require', 'module', 'exports', 'fetch', 'window', code)(
    name => name === 'react' ? react : name === 'react/jsx-runtime' ? jsx : { Eye: () => null, EyeOff: () => null },
    module, module.exports, fetchMock, { location: { search: '' } },
  );
  function render() { cursor = 0; return module.exports.default(); }
  render(); mounted = true;
  effects.forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  function find(predicate) {
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (predicate(node)) return node;
      for (const child of [node.props?.children].flat(Infinity)) {
        const found = walk(child); if (found) return found;
      }
    }
    return walk(render());
  }
  return { find };
}

test('upload retains local preview and already loaded duration; replacement resets both posting target and consent', async () => {
  const { find } = await host();
  const input = () => find(n => n.type === 'input' && n.props.type === 'file');
  input().props.onChange({ target: { files: [new File(['video'], 'first.mp4', { type: 'video/mp4' })] } });
  const video = find(n => n.type === 'video');
  assert.match(video.props.src, /^blob:/);
  video.props.onLoadedMetadata({ currentTarget: { duration: 12 } });
  find(n => n.type === 'button' && n.props.children === 'Upload video to PrimeHubMall').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(find(n => n.type === 'video').props.src, video.props.src);
  assert.ok(find(n => n.type === 'p' && Array.isArray(n.props.children) && n.props.children[0] === 'Duration: '));
  assert.match(find(n => n.type === 'input' && n.props.type === 'url').props.value, /test\.mp4$/);
  input().props.onChange({ target: { files: [new File(['replacement'], 'second.mp4', { type: 'video/mp4' })] } });
  assert.equal(find(n => n.type === 'input' && n.props.type === 'url').props.value, '');
  assert.notEqual(find(n => n.type === 'video').props.src, video.props.src);
  assert.equal(find(n => n.type === 'button' && n.props.children === 'Post privately to TikTok').props.disabled, true);
});

test('unsupported media gives a visible error and never enables posting', async () => {
  const { find } = await host();
  find(n => n.type === 'input' && n.props.type === 'url').props.onChange({ target: { value: 'https://www.primehubmall.com/test.mp4' } });
  find(n => n.type === 'video').props.onError({ currentTarget: { error: { code: 4 } } });
  assert.match(find(n => n.props?.role === 'alert').props.children, /H\.264/);
  assert.equal(find(n => n.type === 'button' && n.props.children === 'Post privately to TikTok').props.disabled, true);
});
