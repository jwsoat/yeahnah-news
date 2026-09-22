# yeah nah news — website (JWSOAT-53)

Working owned hub for the Yeah Nah News MVP. Pipeline-friendly: the automation
just drops an edition JSON into `editions/` and the site renders it. No rebuild,
no template edits, no deploy step beyond copying the file.

## Run locally

```bash
cd yeahnah-news
python -m http.server 8321 --bind 127.0.0.1
# open http://127.0.0.1:8321/
```

Static site, zero dependencies. Host anywhere static files get served (Netlify,
Vercel, GitHub Pages, or a Jwsoat Group own VPS).

## Structure

```
yeahnah-news/
  index.html        # latest edition + email capture
  archive.html      # index of all editions
  editions/
    manifest.json   # ["2026-09-21", ...] list of slugs, newest appended
    2026-09-21.json # one edition (see schema below)
  assets/
    css/site.css    # house style (Q34 tone: irreverent-warm, never mean)
    js/site.js      # renderer: loads manifest, renders editions
```

## How a new edition ships (the 9am pipeline)

1. Automation writes `editions/<YYYY-MM-DD>.json` (schema below).
2. Automation appends `"<YYYY-MM-DD>"` to `editions/manifest.json`.
3. Site picks up the new file on next page load. Done.

## Edition JSON schema

```jsonc
{
  "slug": "2026-09-21",
  "date": "2026-09-21",
  "edition": "Issue #001 — human-readable title",
  "tagline": "3-minute promise line",
  "reading_minutes": 3,
  "stories": [
    {
      "id": "s1",
      "category": "tech | sport | entertainment | ...",
      "headline": "...",
      "summary": "one-liner for archive/list views",
      "body": [
        { "kind": "lead",   "text": "the news, plainly" },
        { "kind": "banter", "text": "the joke — italic, fern-green, house-style (Q34)" },
        { "kind": "fact",   "text": "a verified fact with sourcing clarity" }
      ]
    }
  ],
  "affiliate_cta": {
    "enabled": true,
    "headline": "Making a move? Here's what we'd look at.",
    "body": "shown only after the reader opens the CTA (intent signal, Q38)",
    "disclosure": "We may earn a commission if you buy through these links.",
    "items": [ { "url": "https://...", "label": "Product", "endorsement": "optional note" } ]
  },
  "meta": {
    "sources": ["stuff.co.nz", "nzherald.co.nz", "rnz.co.nz"],
    "qa_verified": true     // MUST be true or the edition is held (QA gate)
  }
}
```

## Editorial / QA rules enforced here (from the confirmed plan)

- **QA gate**: `meta.qa_verified != true` → the edition will not render as current
  (the loader never surfaces a non-verified latest). Validation is also run
  server-side by the pipeline (see below).
- **Banter blocks** (`kind: banter`) are visually distinct from facts — readers can
  always tell the joke from the reporting. Jokes never target victims (Q17/Q34).
- **Affiliate CTA** is bottom-of-story, intent-gated (behind a click), never
  appears above the story, and always carries the disclosure line (Q25/Q38/Q40).
- **Primary sources always primary** (Q7/Q14).

## Validation command (run before publish)

```bash
python - <<'PY'
import json, glob, sys
ok = True
for f in glob.glob('editions/[0-9]*.json'):
    d = json.load(open(f))
    if not d.get('stories'): ok=False; print('no stories:', f)
    if d.get('meta',{}).get('qa_verified') is not True: ok=False; print('not QA-verified:', f)
    ac = d.get('affiliate_cta',{})
    if ac.get('enabled') and not ac.get('disclosure'): ok=False; print('CTA missing disclosure:', f)
print('ALL VALID' if ok else 'HOLD — fix above')
sys.exit(0 if ok else 1)
PY
```

## Status

- [x] Edition JSON schema + sample edition
- [x] Home page renders latest edition (stories, banter, facts, CTA, capture)
- [x] Archive page
- [x] Email capture (Kit-ready endpoint; real Kit connect = JWSOAT-54)
- [x] Affiliate CTA with disclosure + intent gate
- [x] Validation/QA gate script
- [ ] Domain yeahnah.news pointed at the host
- [x] Kit form endpoint wired — capture-form POSTs to Kit v3 (form 9941784, public key, secret in vault) — JWSOAT-54
- [x] Live verify 2026-09-21: subscribe returned subscriberId 11443557755 (200), end-to-end browser test green
- [ ] Deploy target chosen + CI auto-publish from pipeline

Related: JWSOAT-52 (founding), JWSOAT-54 (Kit), JWSOAT-56 (affiliates), JWSOAT-57 (pipeline).