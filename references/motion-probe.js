// Motion probe — paste into a real browser's evaluate (browser-run `evaluate_script` with
// `sourcePath`, Playwright `page.evaluate`). Run it on the LIVE page, then on the rebuild, at
// the owner's viewport (1512x982) and again at 390x844 mobile (reload after emulating).
//
// It answers "which elements move, and what drives the movement?" without anyone having to
// watch the page. Two kinds of drivers are captured:
//   1. SCROLL-driven: scrolls the page top to bottom in 150px steps and records, for every
//      element >30px, opacity / transform / rotate / scale / translate / clip-path / filter /
//      scrollLeft at each step. An element whose value changes with scroll position is an effect
//      (reveal, parallax, horizontal pan, tilt, clip-path circle reveal...). Reported with the
//      scroll range where it changed and first -> last value.
//   2. TIME-driven: document.getAnimations() on an idle page (infinite spins, loops) plus a
//      3-second idle sample of scrollLeft on every overflow-x scroller (auto-scrolling strips).
//
// Output is grouped by Wix component id (comp-xxxx) so one effect on a section prints once.
async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const R = (n) => Math.round(n);
  const compOf = (e) => {
    let p = e;
    while (p && !(p.id && p.id.startsWith('comp-'))) p = p.parentElement;
    return p ? p.id.slice(0, 26) : e.tagName.toLowerCase() + '.' + String(e.className || '').slice(0, 24);
  };
  const KEYS = ['o', 't', 'r', 's', 'tr', 'cp', 'f', 'sl'];
  const read = (e) => {
    const c = getComputedStyle(e);
    return { o: c.opacity, t: c.transform, r: c.rotate, s: c.scale, tr: c.translate, cp: c.clipPath, f: c.filter, sl: String(R(e.scrollLeft)) };
  };
  const all = [...document.querySelectorAll('body *')].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 30 && r.height > 30 && getComputedStyle(e).display !== 'none';
  });

  // ---- 2. time-driven, measured first on an idle page at the top ----
  window.scrollTo(0, 0);
  await sleep(800);
  const anims = document
    .getAnimations()
    .map((a) => {
      const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
      const tg = a.effect && a.effect.target;
      return { target: tg ? compOf(tg) : '?', name: a.animationName || a.transitionProperty || 'script', dur: R(t.duration || 0), iter: t.iterations, state: a.playState };
    })
    .filter((a) => a.iter === Infinity || a.dur > 3000)
    .slice(0, 12);
  const scrollers = all.filter((e) => ['auto', 'scroll'].includes(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth + 20);
  const s0 = scrollers.map((e) => e.scrollLeft);
  await sleep(3000);
  const autoScroll = scrollers
    .map((e, i) => ({ comp: compOf(e), cls: String(e.className).slice(0, 30), from: R(s0[i]), to: R(e.scrollLeft), scrollWidth: e.scrollWidth }))
    .filter((x) => x.from !== x.to);

  // ---- 1. scroll-driven ----
  const maxY = document.documentElement.scrollHeight - innerHeight;
  const series = new Map(all.map((e) => [e, []]));
  for (let y = 0; y <= maxY; y += 150) {
    window.scrollTo(0, y);
    await sleep(110);
    for (const e of all) series.get(e).push([y, read(e)]);
  }
  window.scrollTo(0, 0);

  const rows = [];
  for (const [e, s] of series) {
    const diff = KEYS.filter((k) => new Set(s.map((p) => p[1][k])).size > 1);
    if (!diff.length) continue;
    const first = s[0][1];
    const last = s[s.length - 1][1];
    // y range where it changes
    let yFrom = null, yTo = null;
    for (let i = 1; i < s.length; i++) {
      if (diff.some((k) => s[i][1][k] !== s[i - 1][1][k])) { if (yFrom === null) yFrom = s[i - 1][0]; yTo = s[i][0]; }
    }
    const r = e.getBoundingClientRect();
    rows.push({
      comp: compOf(e), tag: e.tagName.toLowerCase(), pageY: R(r.top + scrollY), w: R(r.width), h: R(r.height),
      changes: diff.join(','), scrollRange: [yFrom, yTo],
      from: Object.fromEntries(diff.map((k) => [k, String(first[k]).slice(0, 48)])),
      to: Object.fromEntries(diff.map((k) => [k, String(last[k]).slice(0, 48)])),
      distinct: Math.max(...diff.map((k) => new Set(s.map((p) => p[1][k])).size)),
    });
  }
  // collapse: first 2 elements per component
  const seen = {};
  const grouped = rows.filter((x) => (seen[x.comp] = (seen[x.comp] || 0) + 1) <= 2).sort((a, b) => a.pageY - b.pageY);
  return { viewport: [innerWidth, innerHeight], pageHeight: document.documentElement.scrollHeight, timeDriven: { animations: anims, autoScroll }, scrollDriven: grouped.slice(0, 70), scrollDrivenCount: rows.length };
};
