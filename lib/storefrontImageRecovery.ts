// Install before image parsing/hydration: React card fallbacks otherwise remove
// failed images before a page-wide recovery handler can see them. This also
// covers native images, category icons, deal previews and product galleries.
export const storefrontImageRecoveryScript = String.raw`
(function () {
  var custom = 'https://images.primehubmall.com';
  var legacy = 'https://pub-157b90419bf04016bdea666e4cbce181.r2.dev';
  var attempts = new WeakMap();

  window.addEventListener('error', function (event) {
    var image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    var source = image.currentSrc || image.src;
    var url;
    try { url = new URL(source); } catch (_) { return; }
    if (url.origin !== custom && url.origin !== legacy && url.origin !== 'https://i.ibb.co') return;

    var state = attempts.get(image);
    // A reused card can later display a different product. Keep a finite budget
    // for the same file even if React or a countdown reasserts its original URL.
    if (!state || state.sources.indexOf(source) === -1) {
      var retry = new URL(source);
      retry.searchParams.set('ph-image-retry', '1');
      var sources = [source];
      if (url.origin === custom || url.origin === legacy) {
        sources.push((url.origin === custom ? legacy : custom) + url.pathname + url.search);
      }
      sources.push(retry.href);
      state = { sources: Array.from(new Set(sources)), index: 0 };
      attempts.set(image, state);
    }
    if (state.index + 1 >= state.sources.length) return;

    state.index += 1;
    // Only stop the component's unavailable/placeholder handler while there is
    // a real recovery URL left. Exhaustion falls through to its normal UI.
    event.stopImmediatePropagation();
    image.removeAttribute('srcset');
    image.src = state.sources[state.index];
  }, true);
})();
`;
