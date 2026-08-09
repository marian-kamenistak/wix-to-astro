# Wix to Astro migration — a skill for AI coding agents

Your Wix site is slow, you don't own the code, and every "migrate to Astro" guide covers the
blog posts and abandons you at the layout. This skill covers the whole site.

It teaches Claude Code (or any capable coding agent) to rebuild a live Wix site in Astro on
Cloudflare Workers so faithfully that the owner struggles to tell the two apart: layout, fonts,
animations, forms, redirects, SEO. Then it makes the rebuild measurably faster than the
original.

By [Marian Kamenistak](https://www.marian.coach/) — engineering-leadership mentor.

## What happened when this ran for real

One overnight run migrated a 51-URL conference site (elc-conference.io): landing page, agenda,
40 speaker profiles, two wired forms, every slug preserved. The rebuild scored Lighthouse
100 / 100 / 100 on mobile (performance, accessibility, best practices) with LCP at 790 ms and
CLS of 0.001. The owner's morning review still found four fidelity gaps the automated checks
missed. Those four gaps became Step 4.8 of the playbook, which is the honest pitch of this
skill: the method includes the failure modes, because it was corrected against a real site
twice, first on engineeringleaders.io and then here.

## The method, in one paragraph

Code-first, not screenshot-first. The agent extracts each section's rendered DOM and computed
CSS from the live page — exact pixels, hex values, font metrics — and rebuilds from those
numbers. Real fonts get identified by downloading the files and reading their name tables,
because Wix ships a font library it mostly doesn't use, so grepping the markup lies. Real
animations come from `document.getAnimations()`, because counting `data-motion` attributes
overstates the animation surface about tenfold. Parallax gets checked separately, because it
doesn't use the Animation API. Screenshots are the sanity check, not the measurement.

## Install

```bash
npx skills add marian-kamenistak/wix-to-astro
```

or clone it straight into your skills directory:

```bash
git clone https://github.com/marian-kamenistak/wix-to-astro ~/.claude/skills/wix-to-astro
```

Then tell your agent to migrate a Wix site. `references/setup.md` lists the tools the skill
expects (Node, wrangler, ffmpeg, Python with fontTools, a real-browser automation tool), each
with one install line and one verify command.

## What's inside

| File | What it carries |
|---|---|
| `SKILL.md` | The 7-phase workflow: recon → scaffold → per-section rebuild → four verification passes → owner review → SEO → cutover |
| `references/playbook.md` | The full method, including the recurring failure patterns from real migrations: the wrong-palette trap, the merged-section spacing collapse, the square-video-in-a-wide-box bug |
| `references/interactivity.md` | Extracting real animation recipes from a live site, the parallax gap, and why the owner's perception outranks your measurement |
| `references/seo.md` | Structural SEO + AI SEO: staging noindex that survives a static build, a 5-type schema cap, tiered robots.txt, crawler-delivery verification, the Lighthouse ≥95 gate |
| `references/setup.md` | Tooling prerequisites with verify commands |

## What it is not

It is not a content exporter. If you want your Wix *blog posts* as Markdown and nothing else,
a small extraction script is the better tool. This skill exists for the case where the site
itself has to survive the move: the design, the behavior, the rankings.

More agent-run tools like this one: [marian.coach/ai-coaching-tools](https://www.marian.coach/ai-coaching-tools/).

MIT licensed. Star it if it saved you a migration weekend. Stars are how other people stuck
on Wix find it.
