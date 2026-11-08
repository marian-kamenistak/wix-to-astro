# Section-by-section parity check (owner-review round)

Run this when the owner says "I see visual differences" — or before they look at all. It is the
pass that found, on elc-conference.io (2026-10-27), ten section-level gaps that four automated
passes and a 100/100/100 Lighthouse had not: a missing 40-photo gallery, a missing venue map,
a 4-column logo wall that should be 5, a caption on the wrong side of a video, a footer with
half its rows, and a rotating badge nobody had measured.

**The principle: measure the DOM on both sites, compare numbers, and only then look at
pictures.** Screenshots tell you *that* something differs; the inventory tells you *which
section* and the per-element probe tells you *which property*.

## 1. Same viewport, same scrollbar

Open live and rebuild in two isolated browser contexts at the owner's real width (a 14" MacBook
is 1512 x 982; macOS overlay scrollbars take **no** width). A recon done in a headed browser
with a 15px scrollbar measures a content column 14px narrower than what the owner sees — on
this site that one difference turned a 5-column logo wall into 4 and shrank the speaker grid
by 60px. Record the width and scrollbar state in the log.

## 2. Section inventory on both pages

One script, both pages: top-level `section` elements (anything not nested in another section),
each as `[top, height, first 30 chars of innerText]`. Diff the two lists:

- a section on live with no counterpart = **missing content** (the gallery);
- same section, different height = measure that section's children;
- heights within ±3px = leave it alone.

Scroll through the page in ~700px steps before measuring so lazy sections mount.

## 3. Per-element probe on the differing sections

Tooling: any real-browser evaluate (the `browser-run` MCP `evaluate_script`, Playwright
`page.evaluate`, or raw CDP) running `getBoundingClientRect()` + `getComputedStyle()` on both
pages. No pixel-diff library is needed; the gate is numeric — section heights within ±3px,
element boxes within ±2px of live.

For each section that differs, dump every element that paints: own text nodes with
`[text, x, y-relative-to-section, w, h, font-size, family, weight, line-height, color,
text-align]`, and every `img`/`video`/`svg` with `[src tail, x, y, w, h, object-fit,
border-radius]`. Rebuild from those numbers. The August recon tables are **stale the moment the
owner edits the live site** — on this site the aftermovie had lost its top padding, a poppy had
become a badge and the FAQ had gained a default-open item in the eight weeks between recon and
review. Re-measure; never patch from the old tables.

## 4. Side-by-side crops, section-aligned

Full-page screenshots of both, then crop **per section pair** using the inventory tops and
heights (the sections do not line up by y once one page is taller), scale each crop to the same
width and paste live | rebuild with the heights in the label. Read the composites in groups.
This is the artefact the owner can confirm against.

## 5. Four capture artefacts that fake a "missing" finding

Before reporting anything missing from a screenshot of the rebuild, rule these out — three of
the "missing" findings in the first round of this check were artefacts:

| What you see | Real cause | Do this before capturing |
|---|---|---|
| Whole sections black, only some cards of a grid painted | reveal-on-scroll CSS (`[data-reveal] { opacity: 0 }`) never fired in a headless full-page capture | set `opacity:1; transform:none` on every reveal element |
| Logos / map / side photos absent, DOM has them | `loading="lazy"` images never entered the viewport | scroll through, then wait until every `img.complete` (cap ~10 s) |
| Parallax layers scattered far from their spots | scroll-linked `translateY` computed against a page-tall viewport | zero the layer transforms, or measure with the section scrolled to centre |
| Section renders but 7-10px off | address/line boxes differ from the recon (`line-height`), not the section | compare the child boxes, fix the child |

The DOM probe is the arbiter: an `<img>` with `complete === true` and `naturalWidth > 0` at
the right rect is present, whatever the JPEG shows.

## 6. Media rule: if the original plays, the rebuild plays

A `<video>` on the live page is reproduced as a `<video>` with the **same playback state** —
autoplay / muted / loop / inline exactly as measured on live, with the same controls overlay —
never as a poster image, and never as `preload="none"` + controls when the original autoplays.
Measure it: read `autoplay`, `muted`, `loop`, `controls`, `paused` and `currentTime` twice a
second apart on the live element. The owner reads a still frame where the original moves as
"you used a screenshot", and they are right. Get the actual file from the site's media store
(Wix: `video.wixstatic.com/video/<id>/<quality>/mp4/file.mp4`, or the resource-timing log when
the `<video>` has no `src` until the player hydrates), re-encode it to a sane size and ship it.

The custom controls are measured too, not designed: list every `button` / `[role=button]` /
`a` inside the live section with its `aria-label`, rect and SVG (Wix: a full-card "Play video"
hit area that turns sound on from the start, plus a corner "Mute" toggle). Reproduce that
behaviour with the same hit areas.

Keep the LCP safe without changing what the owner sees: `poster` + `preload="metadata"`;
under `prefers-reduced-motion: reduce` drop `autoplay` and leave the poster; if the video is
below the fold, start it from an IntersectionObserver instead of the `autoplay` attribute so
the download does not compete with the hero. Verify with a real-browser performance trace at
4x CPU + Slow 4G (LCP breakdown, long tasks) — a Lighthouse run taken while builds or deploys
are running on the same machine reports phantom "Unattributable" long tasks and a score that
means nothing; re-run it idle before acting on it.

Same for decorative **background effects**: a glow, gradient or photo behind a heading is an
`<img>` layer or a `background-image` on live — probe for both (`img`, `video`,
`[style*="background-image"]`, and any element whose computed `background-image` is not
`none`) and rebuild it as a layer with the measured rect and opacity.

## 6b. Parity work must not cost the Lighthouse/PSI score — and how to tell if it did

Adding what the owner saw missing tends to add DOM and scripts. Measured on elc-conference.io
(PSI mobile, the arbiter — local Lighthouse under `taskpolicy -b` reported 38 and 60 for a
page PSI scored 87):

- A gallery of 126 lazy `<img>` in the initial HTML cost ~16 points even inside
  `content-visibility: auto`. Below-the-fold galleries: ship the list in a `data-` attribute
  and build the `<img>` elements after `load`; keep the rows' height in CSS so nothing shifts.
- Any inline script that writes `scrollLeft` or reads `getBoundingClientRect()` before first
  paint forces a full layout (100 ms on a fast Mac, seconds on a phone). Run such code after
  `load` (`document.readyState === 'complete'` check + `load` listener).
- Do not restructure a section's clipping (an inner wrapper so one element can overflow) to
  place a decoration; anchor the decoration to the neighbouring section instead.
- `content-visibility: auto` + `contain-intrinsic-size: auto <measured height>` on far-below-
  fold sections is free and halves Style & Layout.

To know whether a change regressed anything: deploy the pre-change commit to a throwaway
Worker name (`wrangler deploy --name <site>-baseline` from a git worktree), run PSI on both
with a PageSpeed Insights API key, and bisect by swapping single files on the
throwaway. Run them back to back: PSI's device state drifts (the same August build scored 99
and 86 twenty minutes apart, with a 2.3 s white-screen hold in the 86 runs), and PSI serves a
cached result for a few minutes, so identical numbers on repeat calls prove nothing. Delete the
throwaway Worker when done.

## 7. Verify by measurement, then by eye, then by the owner

After the fix: redeploy, re-run the inventory (heights within ±3px), re-run the element probe
on anything that moved, then one more composite for the eye. Log every correction in
`BUILD-LOG.md` as "live → before → after" per section. Then hand it to the owner — their eye
still finds what the probes do not (hover states, scroll feel, a video that should be playing).

## 8. Effects, scale and stacking (added 2026-10-28 after the second owner review)

Four classes of gap that a 1512px static measurement cannot see; the owner found all four by
putting live and rebuild side by side in two half-screen windows.

1. **Transition effects.** Run `motion-probe.js` (this folder) on live and on the rebuild; every
   effect in the live list needs an equivalent. Found on elc-conference.io: an autoplay photo
   carousel (each strip advances one photo every ~3.4-4.1 s, staggered, only while on screen —
   invisible to a scroll probe, caught by sampling `scrollLeft` of in-view scrollers each second);
   a header whose background is transparent at the top and `rgba(0,0,0,.7)` from 10px of scroll,
   0.3 s ease; per-card staggered reveals on the 2025 speakers that the rebuilt page had dropped.
2. **Viewport scaling.** Wix does not reflow between ~900px and its design width, it scales.
   Measure live at TWO desktop widths (1512 and 1280): sections that scale fully give
   height × w/1512 (hero 696 = 822 × 1280/1512); partly-scaling sections show a smaller ratio. Rebuild
   with a per-section CSS `zoom` = 1 − (1 − r) × k (r = innerWidth/1512, set in a head script;
   k fitted per section), put vw-based type tokens at their 1512 values inside zoomed sections
   (otherwise they shrink twice) and pin vw-clamped paddings. Result: every section within 0.5 px
   of live at 1280. A 1512-only recon produces a page that looks 15% too big on every smaller
   desktop screen.
3. **Stacking order.** Read z-order with `elementsFromPoint` on LIVE at each overlap of
   decorative layers and media (it ignores `pointer-events:none` layers, so run it on live, where
   they are interactive, and verify the rebuild visually). Live had the photo cut-outs and glows
   ABOVE the aftermovie video; the rebuild had the video on top.
4. **Wrong asset in the right slot.** When a layer's silhouette differs from live in the
   side-by-side, the file is wrong, not the CSS: re-download that exact layer's `static.wixstatic.com`
   original from the live `<img src>` (here a striped pink ball had been replaced by a duplicate badge).

Verification pattern: two Chrome windows, live left / rebuild right, same width, scroll both.
